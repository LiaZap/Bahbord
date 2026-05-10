import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes de optimistic concurrency em PUT /api/projects/[id]/spec.
 *
 * Estratégia:
 *  - Mock query() com mockImplementation que detecta o SQL via regex e
 *    retorna shapes diferentes (project lookup, version lookup, UPSERT,
 *    backlinks delete/insert).
 *  - Mock auth retornando admin do workspace dono do projeto.
 *  - Mock access-check pra GET (não usado nos testes de PUT).
 *
 * Casos cobertos:
 *  1. Conflito otimista: DB version=2, client envia version=1 → 409
 *  2. Match: DB version=2, client envia version=2 → 200, UPSERT com version=3
 *  3. Project não existe → 404
 *  4. Project arquivado → 409 (read-only)
 *  5. version ausente / negativa → 400
 *  6. Não admin → 403
 *
 * NÃO testamos:
 *  - Backlinks regex/sync extensivamente — basta validar que o flow chega
 *    em DELETE+INSERT quando há matches.
 *  - 512KB hard limit (trivial; coberto por inspeção visual).
 */

const queryMock = vi.fn();

vi.mock('@/lib/db', () => ({
  query: queryMock,
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthMember: vi.fn(),
  isAdmin: (role: string) => role === 'owner' || role === 'admin',
}));

vi.mock('@/lib/access-check', () => ({
  hasProjectAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: null, userAgent: null }),
}));

const ADMIN = {
  id: 'admin-1',
  clerk_id: 'ck-1',
  workspace_id: 'ws-1',
  role: 'admin',
  display_name: 'Admin',
  email: 'a@b.com',
  is_approved: true,
};

/**
 * Configura mocks de query baseado no estado simulado.
 *  - projectExists: false → SELECT projects retorna vazio
 *  - projectArchived: aplica is_archived=true
 *  - currentVersion: o que o SELECT version retorna
 */
function setupQueries(opts: {
  projectExists?: boolean;
  projectArchived?: boolean;
  currentVersion?: number;
}) {
  const projectExists = opts.projectExists ?? true;
  const projectArchived = opts.projectArchived ?? false;
  const currentVersion = opts.currentVersion ?? 0;

  queryMock.mockImplementation((sql: string) => {
    // SELECT workspace_id, is_archived FROM projects WHERE id = $1
    if (/SELECT\s+workspace_id,\s*is_archived\s+FROM\s+projects/i.test(sql)) {
      return Promise.resolve({
        rows: projectExists
          ? [{ workspace_id: 'ws-1', is_archived: projectArchived }]
          : [],
        rowCount: projectExists ? 1 : 0,
      });
    }
    // SELECT version FROM project_specs WHERE project_id = $1
    if (/SELECT\s+version\s+FROM\s+project_specs/i.test(sql)) {
      return Promise.resolve({
        rows: currentVersion > 0 ? [{ version: currentVersion }] : [],
        rowCount: currentVersion > 0 ? 1 : 0,
      });
    }
    // INSERT INTO project_specs ... ON CONFLICT (UPSERT)
    if (/INSERT\s+INTO\s+project_specs/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    // DELETE FROM project_spec_backlinks
    if (/DELETE\s+FROM\s+project_spec_backlinks/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    // SELECT id, ticket_key FROM tickets_full ... (busca de backlinks)
    if (/SELECT\s+id,\s*ticket_key\s+FROM\s+tickets_full/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    // INSERT backlinks bulk
    if (/INSERT\s+INTO\s+project_spec_backlinks/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    throw new Error(`SQL não mockado: ${sql.slice(0, 80)}`);
  });
}

function makePut(body: unknown): Request {
  return new Request('http://localhost/api/projects/proj-1/spec', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api/projects/[id]/spec — PUT optimistic concurrency', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const authMod = await import('@/lib/api-auth');
    (authMod.getAuthMember as ReturnType<typeof vi.fn>).mockResolvedValue(ADMIN);
  });

  it('conflito: DB version=2, client envia version=1 → 409 com current_version=2', async () => {
    setupQueries({ currentVersion: 2 });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: '<p>x</p>', content_text: 'x', version: 1 }),
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/Conflito/i);
    expect(json.current_version).toBe(2);

    // UPSERT NUNCA deve ser chamado em conflito
    const upsertCalls = queryMock.mock.calls.filter((c) =>
      /INSERT\s+INTO\s+project_specs/i.test(c[0])
    );
    expect(upsertCalls.length).toBe(0);
  });

  it('match: DB version=2, client envia version=2 → 200, UPSERT com version=3', async () => {
    setupQueries({ currentVersion: 2 });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: '<p>novo</p>', content_text: 'novo', version: 2 }),
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.version).toBe(3);

    // Confere que o UPSERT recebeu version = 3 como último parâmetro
    const upsertCall = queryMock.mock.calls.find((c) =>
      /INSERT\s+INTO\s+project_specs/i.test(c[0])
    );
    expect(upsertCall).toBeTruthy();
    const params = upsertCall![1] as unknown[];
    // Conforme route.ts: $6 é version (índice 5)
    expect(params[5]).toBe(3);
  });

  it('primeiro save (DB sem row) com client.version=0 → 200, UPSERT com version=1', async () => {
    setupQueries({ currentVersion: 0 });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: '<p>first</p>', content_text: 'first', version: 0 }),
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.version).toBe(1);
  });

  it('project não existe → 404', async () => {
    setupQueries({ projectExists: false });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: 'x', content_text: 'x', version: 0 }),
      { params: { id: 'inexistente' } }
    );

    expect(res.status).toBe(404);
  });

  it('project arquivado → 409 read-only', async () => {
    setupQueries({ projectArchived: true });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: 'x', content_text: 'x', version: 0 }),
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/arquivado/i);
  });

  it('version ausente → 400', async () => {
    setupQueries({ currentVersion: 0 });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: 'x', content_text: 'x' }), // sem version
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(400);
  });

  it('version negativa → 400', async () => {
    setupQueries({ currentVersion: 0 });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: 'x', content_text: 'x', version: -1 }),
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(400);
  });

  it('não admin → 403 (sem tocar no DB)', async () => {
    const authMod = await import('@/lib/api-auth');
    (authMod.getAuthMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...ADMIN,
      role: 'member',
    });
    setupQueries({ currentVersion: 2 });

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: 'x', content_text: 'x', version: 2 }),
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('não autenticado → 401', async () => {
    const authMod = await import('@/lib/api-auth');
    (authMod.getAuthMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const mod = await import('@/app/api/projects/[id]/spec/route');
    const res: Response = await mod.PUT(
      makePut({ content_html: 'x', content_text: 'x', version: 0 }),
      { params: { id: 'proj-1' } }
    );

    expect(res.status).toBe(401);
  });
});
