import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Regression test do bug que o Tech Lead corrigiu em DELETE /api/initiatives/[id]:
 *   - Antes: DELETE só por id → permitia apagar initiative de outro workspace
 *     (cross-tenant leak).
 *   - Depois: DELETE com filtro `workspace_id = $2` extra + RETURNING.
 *     Se initiative pertencer a outro workspace → rowCount=0 → 404.
 *
 * Estratégia híbrida (recomendada pelo Tech Lead):
 *  1) Smoke test do handler: importa o módulo, garante que DELETE existe
 *     e tem assinatura compatível.
 *  2) Source assertion: lê o arquivo route.ts e verifica que o DELETE SQL
 *     contém os marcadores críticos:
 *       - "WHERE id = $1 AND workspace_id = $2"
 *       - "RETURNING workspace_id"
 *     Isso pega regressão se alguém remover acidentalmente o filtro.
 *  3) Behavioral test com mocks: simula initiative de outro workspace
 *     (mock query retorna rowCount=0) → handler retorna 404, NÃO 200.
 *
 * NÃO testamos (assumido pelo plano):
 *  - GET / PATCH cross-tenant — GET já tem `if (workspace_id !== auth.workspace_id) return 403`
 *    explícito; bug do Tech Lead foi específico do DELETE.
 */

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthMember: vi.fn(),
  isAdmin: (role: string) => role === 'owner' || role === 'admin',
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: null, userAgent: null }),
}));

vi.mock('@/lib/initiatives', () => ({
  computeInitiativeProgress: vi.fn().mockResolvedValue({ percentage: 0, total: 0, done: 0 }),
}));

const ROUTE_PATH = path.resolve(
  __dirname,
  '../../app/api/initiatives/[id]/route.ts'
);

describe('api/initiatives/[id] — cross-tenant regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('smoke: módulo exporta DELETE handler', async () => {
    const mod = await import('@/app/api/initiatives/[id]/route');
    expect(typeof mod.DELETE).toBe('function');
    expect(typeof mod.GET).toBe('function');
    expect(typeof mod.PATCH).toBe('function');
  });

  it('source: DELETE SQL filtra por workspace_id (regression Tech Lead)', () => {
    const source = readFileSync(ROUTE_PATH, 'utf-8');
    // Localiza o bloco do DELETE handler e extrai a query SQL específica.
    const deleteBlock = source.match(/export\s+async\s+function\s+DELETE[\s\S]*?^\}/m);
    expect(deleteBlock, 'bloco DELETE handler não encontrado').toBeTruthy();

    const block = deleteBlock![0];
    expect(block).toMatch(/DELETE\s+FROM\s+initiatives/i);
    // Marcadores críticos: filtro por workspace + RETURNING pra detectar 0 rows.
    expect(
      block,
      'DELETE deve filtrar por workspace_id pra evitar cross-tenant leak'
    ).toMatch(/WHERE\s+id\s*=\s*\$1\s+AND\s+workspace_id\s*=\s*\$2/i);
    expect(block).toMatch(/RETURNING/i);
  });

  it('behavior: DELETE com initiative de OUTRO workspace → 404', async () => {
    const dbMod = await import('@/lib/db');
    const authMod = await import('@/lib/api-auth');

    // Auth: admin do workspace "ws-A"
    (authMod.getAuthMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'admin-1',
      clerk_id: 'ck-1',
      workspace_id: 'ws-A',
      role: 'admin',
      display_name: 'Admin',
      email: 'a@b.com',
      is_approved: true,
    });

    // Mock query: DELETE não casa porque initiative pertence a outro workspace
    // → rowCount 0, rows vazias.
    (dbMod.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const mod = await import('@/app/api/initiatives/[id]/route');
    const req = new Request('http://localhost/api/initiatives/init-from-ws-B', {
      method: 'DELETE',
    });
    const res: Response = await mod.DELETE(req, { params: { id: 'init-from-ws-B' } });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Initiative não encontrada');
  });

  it('behavior: DELETE de initiative do MESMO workspace → 200', async () => {
    const dbMod = await import('@/lib/db');
    const authMod = await import('@/lib/api-auth');

    (authMod.getAuthMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'admin-1',
      clerk_id: 'ck-1',
      workspace_id: 'ws-A',
      role: 'admin',
      display_name: 'Admin',
      email: 'a@b.com',
      is_approved: true,
    });

    // Match — initiative pertence ao mesmo workspace
    (dbMod.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [{ workspace_id: 'ws-A', name: 'Initiative X' }],
      rowCount: 1,
    });

    const mod = await import('@/app/api/initiatives/[id]/route');
    const req = new Request('http://localhost/api/initiatives/init-X', {
      method: 'DELETE',
    });
    const res: Response = await mod.DELETE(req, { params: { id: 'init-X' } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Confere que workspace_id do auth foi enviado como $2 (anti-regressão)
    const deleteCall = (dbMod.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(deleteCall[1]).toEqual(['init-X', 'ws-A']);
  });

  it('behavior: usuário NÃO admin → 403 sem nem chegar no DELETE', async () => {
    const dbMod = await import('@/lib/db');
    const authMod = await import('@/lib/api-auth');

    (authMod.getAuthMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'viewer-1',
      clerk_id: 'ck-2',
      workspace_id: 'ws-A',
      role: 'member', // não é admin/owner
      display_name: 'Member',
      email: 'm@b.com',
      is_approved: true,
    });

    const mod = await import('@/app/api/initiatives/[id]/route');
    const req = new Request('http://localhost/api/initiatives/init-X', {
      method: 'DELETE',
    });
    const res: Response = await mod.DELETE(req, { params: { id: 'init-X' } });

    expect(res.status).toBe(403);
    expect(dbMod.query).not.toHaveBeenCalled();
  });

  it('behavior: não autenticado → 401', async () => {
    const authMod = await import('@/lib/api-auth');
    (authMod.getAuthMember as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const mod = await import('@/app/api/initiatives/[id]/route');
    const req = new Request('http://localhost/api/initiatives/init-X', {
      method: 'DELETE',
    });
    const res: Response = await mod.DELETE(req, { params: { id: 'init-X' } });

    expect(res.status).toBe(401);
  });
});
