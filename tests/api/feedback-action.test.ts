import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes da Server Action submitFeedback.
 *
 * Estratégia:
 *  - Server Actions são funções async normais → testáveis diretamente.
 *  - Mock @/lib/db: query() retorna RETURNING id sintético; getDefaultWorkspaceId
 *    retorna ws fake.
 *  - Mock @/lib/audit: logAudit no-op.
 *  - Mock next/headers: retorna Headers vazio (action lê x-forwarded-for, etc).
 *
 * NÃO testamos:
 *  - Erro do logAudit isoladamente — handler já swallow via try/catch externo,
 *    e o foco da auditoria fase 4 é validação de input.
 *  - SQL injection direto no body — Postgres parameterized statements já cobrem.
 */

vi.mock('@/lib/db', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ id: 'cr-fake-uuid' }], rowCount: 1 }),
  getDefaultWorkspaceId: vi.fn().mockResolvedValue('ws-default'),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: null, userAgent: null }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

describe('app/feedback/actions — submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita email sem @', async () => {
    const { submitFeedback } = await import('@/app/feedback/actions');
    const r = await submitFeedback({
      customer_email: 'naoehemail',
      request_text: 'Quero ajuda',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('E-mail inválido');
  });

  it('rejeita email vazio', async () => {
    const { submitFeedback } = await import('@/app/feedback/actions');
    const r = await submitFeedback({
      customer_email: '',
      request_text: 'Texto qualquer',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('E-mail inválido');
  });

  it('rejeita email só com @ (regex valida formato mínimo)', async () => {
    const { submitFeedback } = await import('@/app/feedback/actions');
    const r = await submitFeedback({
      customer_email: '@.',
      request_text: 'x',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('E-mail inválido');
  });

  it('rejeita texto vazio mesmo com email válido', async () => {
    const { submitFeedback } = await import('@/app/feedback/actions');
    const r = await submitFeedback({
      customer_email: 'a@b.com',
      request_text: '   ', // só espaços → trim resulta em vazio
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Descrição obrigatória');
  });

  it('rejeita texto > 5000 chars', async () => {
    const { submitFeedback } = await import('@/app/feedback/actions');
    const longText = 'a'.repeat(5001);
    const r = await submitFeedback({
      customer_email: 'a@b.com',
      request_text: longText,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('máx');
  });

  it('aceita texto com exatamente 5000 chars', async () => {
    const { submitFeedback } = await import('@/app/feedback/actions');
    const text = 'a'.repeat(5000);
    const r = await submitFeedback({
      customer_email: 'a@b.com',
      request_text: text,
    });
    expect(r.ok).toBe(true);
  });

  it('rejeita nome > 200 chars', async () => {
    const { submitFeedback } = await import('@/app/feedback/actions');
    const r = await submitFeedback({
      customer_email: 'a@b.com',
      customer_name: 'n'.repeat(201),
      request_text: 'ok',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Nome muito longo');
  });

  it('payload válido completo → ok=true e query foi chamada com workspace correto', async () => {
    const dbMod = await import('@/lib/db');
    const { submitFeedback } = await import('@/app/feedback/actions');
    const r = await submitFeedback({
      customer_email: 'cliente@example.com',
      customer_name: 'João',
      request_text: 'Quero relatar um bug',
      source_url: 'https://example.com/page',
    });

    expect(r.ok).toBe(true);
    expect(r.error).toBeUndefined();
    expect(dbMod.query).toHaveBeenCalledTimes(1);

    // Confere os params do INSERT
    const callArgs = (dbMod.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toMatch(/INSERT INTO customer_requests/);
    expect(callArgs[1]).toEqual([
      'ws-default',
      'cliente@example.com',
      'João',
      'Quero relatar um bug',
      'https://example.com/page',
    ]);
  });

  it('payload sem nome → name persistido como null', async () => {
    const dbMod = await import('@/lib/db');
    const { submitFeedback } = await import('@/app/feedback/actions');
    await submitFeedback({
      customer_email: 'cliente@example.com',
      request_text: 'Sem nome',
    });

    const callArgs = (dbMod.query as ReturnType<typeof vi.fn>).mock.calls[0];
    // 3º param do array de bindings é o name (índice 2)
    expect(callArgs[1][2]).toBeNull();
  });

  it('falha do DB → retorna erro genérico (sem vazar message)', async () => {
    const dbMod = await import('@/lib/db');
    (dbMod.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection refused')
    );

    const { submitFeedback } = await import('@/app/feedback/actions');
    const r = await submitFeedback({
      customer_email: 'a@b.com',
      request_text: 'X',
    });

    expect(r.ok).toBe(false);
    expect(r.error).toContain('Erro interno');
    // NÃO deve vazar o "connection refused" pro cliente
    expect(r.error).not.toContain('connection refused');
  });
});
