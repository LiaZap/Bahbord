import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InboxItem, TriageContext } from '@/lib/ai-triage';

/**
 * Testes do fallback de classifyInboxItem.
 *
 * Estratégia:
 *  - Mock do construtor OpenAI: retorna um cliente falso cujo
 *    chat.completions.create é controlado via vi.fn() exposto.
 *  - Mock embeddings.findSimilarTickets pra evitar lookup real de duplicatas.
 *  - Mock @/lib/db pra evitar pool real.
 *  - vi.stubEnv('OPENAI_API_KEY', '') força caminho fallback (isAvailable=false).
 *
 * O módulo ai-triage instancia o OpenAI client no top-level — então o mock
 * precisa estar setado ANTES do primeiro import. Usamos import dinâmico
 * dentro de cada test pra garantir env+mocks corretos.
 */

// Captura do mock pra customizar resposta por teste
const mockCreate = vi.fn();

// OpenAI é instanciado via `new OpenAI({...})` — precisa ser uma classe
// (vi.fn().mockImplementation não funciona como constructor).
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    embeddings = { create: vi.fn() };
    constructor(_config?: unknown) {}
  },
}));

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));

// findSimilarTickets é chamado no path "duplicate match" — sempre retorna []
// pra que esses testes foquem somente no parse/fallback, não na duplicação.
vi.mock('@/lib/embeddings', () => ({
  findSimilarTickets: vi.fn().mockResolvedValue([]),
}));

const baseItem: InboxItem = {
  id: 'item-1',
  workspace_id: 'ws-1',
  title: 'Sistema fora do ar',
  description: 'A produção caiu, urgente',
  source: 'email',
  reporter_email: 'cliente@example.com',
};

const baseCtx: TriageContext = {
  projects: [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Backend', prefix: 'BE' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Frontend', prefix: 'FE' },
  ],
  available_labels: [
    { id: 'l1', name: 'bug' },
    { id: 'l2', name: 'feature' },
  ],
  members: [
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', display_name: 'Alice', role: 'admin' },
  ],
};

describe('lib/ai-triage — fallback paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sem OPENAI_API_KEY → fallback "IA indisponível"', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const { classifyInboxItem } = await import('@/lib/ai-triage');

    const out = await classifyInboxItem(baseItem, baseCtx);

    expect(out.priority).toBe('medium');
    expect(out.confidence).toBe('low');
    expect(out.reasoning).toBe('IA indisponível');
    expect(out.suggested_project_id).toBeNull();
    expect(out.suggested_assignee_id).toBeNull();
    expect(out.suggested_labels).toEqual([]);
    expect(out.duplicate_ticket_id).toBeNull();
    // mockCreate NÃO deve ter sido chamado
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('OpenAI throw (rede / timeout) → fallback', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');
    mockCreate.mockRejectedValueOnce(new Error('ECONNRESET'));

    const { classifyInboxItem } = await import('@/lib/ai-triage');
    const out = await classifyInboxItem(baseItem, baseCtx);

    expect(out.reasoning).toBe('IA indisponível');
    expect(out.priority).toBe('medium');
    expect(out.confidence).toBe('low');
  });

  it('JSON inválido na resposta → fallback', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'isso não é json {{{' } }],
    });

    const { classifyInboxItem } = await import('@/lib/ai-triage');
    const out = await classifyInboxItem(baseItem, baseCtx);

    expect(out.reasoning).toBe('IA indisponível');
  });

  it('UUID alucinado de projeto (não existe em ctx) → null', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              priority: 'high',
              suggested_project_id: '99999999-9999-9999-9999-999999999999', // não existe
              suggested_labels: ['bug'],
              suggested_assignee_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // não existe
              summary: 'Resumo',
              reasoning: 'Análise',
              confidence: 'medium',
            }),
          },
        },
      ],
    });

    const { classifyInboxItem } = await import('@/lib/ai-triage');
    const out = await classifyInboxItem(baseItem, baseCtx);

    expect(out.priority).toBe('high');
    // UUIDs alucinados devem ser filtrados pra null
    expect(out.suggested_project_id).toBeNull();
    expect(out.suggested_assignee_id).toBeNull();
    // Labels devem passar normalmente
    expect(out.suggested_labels).toEqual(['bug']);
    expect(out.summary).toBe('Resumo');
  });

  it('UUID válido de projeto (existe em ctx) → mantido', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');
    const validProject = baseCtx.projects[0].id;
    const validMember = baseCtx.members[0].id;

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              priority: 'urgent',
              suggested_project_id: validProject,
              suggested_labels: ['bug', 'urgent'],
              suggested_assignee_id: validMember,
              summary: 'Sistema fora do ar',
              reasoning: 'Produção parada',
              confidence: 'high',
            }),
          },
        },
      ],
    });

    const { classifyInboxItem } = await import('@/lib/ai-triage');
    const out = await classifyInboxItem(baseItem, baseCtx);

    expect(out.priority).toBe('urgent');
    expect(out.suggested_project_id).toBe(validProject);
    expect(out.suggested_assignee_id).toBe(validMember);
    expect(out.confidence).toBe('high');
  });

  it('workspace SEM projetos → suggested_project_id null + confidence low', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');
    const ctxNoProjects: TriageContext = {
      projects: [],
      available_labels: baseCtx.available_labels,
      members: baseCtx.members,
    };

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              priority: 'high',
              suggested_project_id: 'qualquer-coisa',
              suggested_labels: ['bug'],
              suggested_assignee_id: null,
              summary: 'X',
              reasoning: 'Y',
              confidence: 'high', // modelo achou que era high
            }),
          },
        },
      ],
    });

    const { classifyInboxItem } = await import('@/lib/ai-triage');
    const out = await classifyInboxItem(baseItem, ctxNoProjects);

    expect(out.suggested_project_id).toBeNull();
    // Confidence é DOWNGRADED pra low quando workspace não tem projetos
    expect(out.confidence).toBe('low');
  });

  it('priority inválida do modelo → coerce pra "medium"', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-fake');
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              priority: 'CRITICAL', // não está na whitelist
              suggested_project_id: null,
              suggested_labels: [],
              suggested_assignee_id: null,
              summary: 'x',
              reasoning: 'y',
              confidence: 'high',
            }),
          },
        },
      ],
    });

    const { classifyInboxItem } = await import('@/lib/ai-triage');
    const out = await classifyInboxItem(baseItem, baseCtx);

    expect(out.priority).toBe('medium');
  });
});
