import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Testes de autenticação dos 4 cron endpoints.
 *
 * Estratégia:
 *  - vi.mock hoisted pra @/lib/db, @/lib/notifications, @/lib/recurring,
 *    @/lib/project-updates, @/lib/sprint-rollover. Tudo no-op pra evitar
 *    side effects (DB, fetch, etc).
 *  - vi.stubEnv pra alternar CRON_SECRET / NODE_ENV por caso de teste.
 *  - Cada endpoint é importado dinamicamente DENTRO do `it` pra que o
 *    process.env já esteja com os stubs corretos quando o módulo for
 *    avaliado (módulos cron leem process.env em isAuthorized() — isso
 *    é runtime-safe, mas reset garante isolamento).
 *
 * NOTE: NÃO testamos o caso "dev sem secret" porque é trivial e o foco do
 * Tech Lead é garantir que prod NUNCA passe sem secret.
 */

// Mock infra: query retorna 0 rows pra todos os SELECTs e UPDATEs.
vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

// Notifications são fire-and-forget — nunca devem ser chamadas se 401.
vi.mock('@/lib/notifications', () => ({
  notifyMember: vi.fn(),
}));

// Recurring helper — só executa se passar pelo guard.
vi.mock('@/lib/recurring', () => ({
  computeNextRunAt: vi.fn().mockReturnValue(new Date('2099-01-01')),
  renderTitleTemplate: vi.fn().mockReturnValue('mocked-title'),
}));

vi.mock('@/lib/project-updates', () => ({
  generateAndSaveUpdateForProject: vi.fn().mockResolvedValue({ status: 'created', id: 'fake' }),
}));

vi.mock('@/lib/sprint-rollover', () => ({
  rolloverSprint: vi.fn().mockResolvedValue({
    old_sprint_id: 'old',
    new_sprint_id: 'new',
    moved_count: 0,
    archived_count: 0,
    strategy: 'move_incomplete',
  }),
}));

const ENDPOINTS = [
  { path: '@/app/api/cron/sla-check/route', name: 'sla-check' },
  { path: '@/app/api/cron/recurring-tickets/route', name: 'recurring-tickets' },
  { path: '@/app/api/cron/project-updates/route', name: 'project-updates' },
  { path: '@/app/api/cron/sprint-rollover/route', name: 'sprint-rollover' },
] as const;

const CORRECT_SECRET = 'super-secret-cron-token-1234567890';
const WRONG_SECRET = 'wrong-secret-with-same-len-haha-12';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/x', {
    method: 'POST',
    headers,
  });
}

describe('cron auth — todos os 4 endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Garante que cada teste começa com env limpa
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  for (const ep of ENDPOINTS) {
    describe(ep.name, () => {
      it('em produção SEM nenhum header → 401', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', CORRECT_SECRET);

        const mod = await import(ep.path);
        const res: Response = await mod.POST(makeRequest());

        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe('Unauthorized');
      });

      it('em produção com x-cron-secret ERRADO → 401', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', CORRECT_SECRET);

        const mod = await import(ep.path);
        const res: Response = await mod.POST(
          makeRequest({ 'x-cron-secret': WRONG_SECRET })
        );

        expect(res.status).toBe(401);
      });

      it('em produção com Bearer ERRADO → 401', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', CORRECT_SECRET);

        const mod = await import(ep.path);
        const res: Response = await mod.POST(
          makeRequest({ authorization: `Bearer ${WRONG_SECRET}` })
        );

        expect(res.status).toBe(401);
      });

      it('em produção sem CRON_SECRET configurado → 401 (loud-fail)', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', '');

        const mod = await import(ep.path);
        const res: Response = await mod.POST(
          makeRequest({ 'x-cron-secret': 'qualquer-coisa' })
        );

        expect(res.status).toBe(401);
      });

      it('com x-cron-secret CORRETO → executa (200)', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', CORRECT_SECRET);

        const mod = await import(ep.path);
        const res: Response = await mod.POST(
          makeRequest({ 'x-cron-secret': CORRECT_SECRET })
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
      });

      it('com Authorization Bearer CORRETO → executa (200)', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('CRON_SECRET', CORRECT_SECRET);

        const mod = await import(ep.path);
        const res: Response = await mod.POST(
          makeRequest({ authorization: `Bearer ${CORRECT_SECRET}` })
        );

        expect(res.status).toBe(200);
      });
    });
  }
});
