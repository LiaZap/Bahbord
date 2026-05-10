import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Testes do /api/ai/chat reescrito com function calling (Fase 7.1).
 *
 * Estratégia:
 *  - Mock @/lib/api-auth pra controlar role/auth por teste.
 *  - Mock @/lib/audit pra evitar INSERT real.
 *  - Mock @/lib/db pra cada query do catálogo retornar rows controladas.
 *  - Mock openai como classe (igual ai-triage-fallback.test.ts) pra controlar
 *    a resposta de tool_calls.
 *  - vi.stubEnv pra alternar OPENAI_API_KEY.
 *  - import dinâmico do route DENTRO de cada `it` pra que mocks/env estejam
 *    aplicados antes do top-level OpenAI ser instanciado.
 *
 * Foco: provar que NÃO existe mais caminho onde SQL livre é executado, e que
 * o handler é resiliente a function names desconhecidos / args malformados.
 */

const mockGetAuthMember = vi.fn();
const mockIsAdmin = vi.fn((role: string) => role === 'admin' || role === 'owner');
const mockQuery = vi.fn();
const mockLogAudit = vi.fn().mockResolvedValue(undefined);
const mockExtractMeta = vi
  .fn()
  .mockReturnValue({ ipAddress: null, userAgent: null });
const mockChatCreate = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  getAuthMember: mockGetAuthMember,
  isAdmin: mockIsAdmin,
}));

vi.mock('@/lib/audit', () => ({
  logAudit: mockLogAudit,
  extractRequestMeta: mockExtractMeta,
}));

vi.mock('@/lib/db', () => ({
  query: mockQuery,
}));

// rate-limit: in-memory; nos testes começa do zero a cada arquivo,
// e 30/min é folgado pros 6 testes — não precisa mock.

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
    constructor(_cfg?: unknown) {}
  },
}));

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ADMIN_AUTH = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  clerk_id: 'clerk-1',
  workspace_id: '11111111-1111-1111-1111-111111111111',
  role: 'admin',
  display_name: 'Admin',
  email: 'admin@example.com',
  is_approved: true,
};

const VIEWER_AUTH = { ...ADMIN_AUTH, role: 'viewer' };

describe('POST /api/ai/chat — function calling (sem SQL livre)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sem auth → 401', async () => {
    mockGetAuthMember.mockResolvedValueOnce(null);

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(makeRequest({ question: 'oi' }));

    expect(res.status).toBe(401);
    const j = await res.json();
    expect(j.error).toBe('Não autenticado');
    // Não deve nem tentar chamar OpenAI
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('não-admin (viewer) → 403', async () => {
    mockGetAuthMember.mockResolvedValueOnce(VIEWER_AUTH);

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(makeRequest({ question: 'oi' }));

    expect(res.status).toBe(403);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('sem OPENAI_API_KEY → 503', async () => {
    mockGetAuthMember.mockResolvedValueOnce(ADMIN_AUTH);
    vi.stubEnv('OPENAI_API_KEY', '');

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(makeRequest({ question: 'oi' }));

    expect(res.status).toBe(503);
    const j = await res.json();
    expect(j.error).toBe('IA não configurada');
  });

  it('question vazio → 400', async () => {
    mockGetAuthMember.mockResolvedValueOnce(ADMIN_AUTH);
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(makeRequest({ question: '   ' }));

    expect(res.status).toBe(400);
  });

  it('tool_call de função desconhecida → resultado tem error, sem executar SQL', async () => {
    mockGetAuthMember.mockResolvedValueOnce(ADMIN_AUTH);
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');

    mockChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'drop_all_tables', // alucinação maliciosa
                  arguments: '{}',
                },
              },
            ],
          },
        },
      ],
    });

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(
      makeRequest({ question: 'apague tudo' }),
    );

    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.function_results).toHaveLength(1);
    expect(j.function_results[0].name).toBe('drop_all_tables');
    expect(j.function_results[0].error).toBe('Função desconhecida');
    // Crítico: query() NUNCA foi chamada
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('tool_call com argumentos JSON malformados → error sem executar query', async () => {
    mockGetAuthMember.mockResolvedValueOnce(ADMIN_AUTH);
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');

    mockChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'tickets_assigned_to_member',
                  arguments: '{not json',
                },
              },
            ],
          },
        },
      ],
    });

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(makeRequest({ question: 'x' }));

    const j = await res.json();
    expect(j.function_results[0].error).toContain('Argumentos inválidos');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('tool_call válida → executa função e retorna result com columns+rows', async () => {
    mockGetAuthMember.mockResolvedValueOnce(ADMIN_AUTH);
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');

    // Resposta da query do catálogo (tickets_by_status)
    mockQuery.mockResolvedValueOnce({
      rows: [
        { status: 'Em andamento', count: 12 },
        { status: 'Concluído', count: 5 },
      ],
      rowCount: 2,
    });

    mockChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'Aqui está o resumo:',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'tickets_by_status',
                  arguments: '{}',
                },
              },
            ],
          },
        },
      ],
    });

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(
      makeRequest({ question: 'quantos tickets em cada status?' }),
    );

    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.text).toBe('Aqui está o resumo:');
    expect(j.function_results).toHaveLength(1);
    const fr = j.function_results[0];
    expect(fr.name).toBe('tickets_by_status');
    expect(fr.error).toBeUndefined();
    expect(fr.result.columns).toEqual(['status', 'count']);
    expect(fr.result.rows).toEqual([
      ['Em andamento', 12],
      ['Concluído', 5],
    ]);

    // Verifica que a query foi chamada COM workspace_id do auth (NÃO dos params)
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toEqual([ADMIN_AUTH.workspace_id]);

    // Auditoria foi registrada
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
    expect(mockLogAudit.mock.calls[0][0].action).toBe('ai_chat.query');
  });

  it('tool_call com UUID inválido em parâmetro required → error, sem chegar no SQL', async () => {
    mockGetAuthMember.mockResolvedValueOnce(ADMIN_AUTH);
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');

    mockChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'tickets_assigned_to_member',
                  // UUID alucinado / não-UUID
                  arguments: JSON.stringify({ member_id: 'não-é-uuid' }),
                },
              },
            ],
          },
        },
      ],
    });

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(
      makeRequest({ question: 'tickets do João' }),
    );

    const j = await res.json();
    expect(j.function_results[0].error).toBe('Erro ao executar função');
    // Crítico: SQL nunca foi montado/executado porque a validação de UUID falhou
    // antes do call ao pool.
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('múltiplas tool_calls em sequência → cada uma é executada independentemente', async () => {
    mockGetAuthMember.mockResolvedValueOnce(ADMIN_AUTH);
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');

    mockQuery
      .mockResolvedValueOnce({ rows: [{ priority: 'urgent', count: 3 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ status: 'Backlog', count: 7 }], rowCount: 1 });

    mockChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'Análise dupla:',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'tickets_by_priority', arguments: '{}' },
              },
              {
                id: 'call_2',
                type: 'function',
                function: { name: 'tickets_by_status', arguments: '{}' },
              },
            ],
          },
        },
      ],
    });

    const mod = await import('@/app/api/ai/chat/route');
    const res: Response = await mod.POST(makeRequest({ question: 'snapshot' }));

    const j = await res.json();
    expect(j.function_results).toHaveLength(2);
    expect(j.function_results.map((r: { name: string }) => r.name)).toEqual([
      'tickets_by_priority',
      'tickets_by_status',
    ]);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
