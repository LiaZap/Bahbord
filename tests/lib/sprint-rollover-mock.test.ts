import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes de rolloverSprint com mock detalhado do query().
 *
 * Estratégia:
 *  - vi.mock('@/lib/db', ...) com query implementado via vi.fn() captured.
 *  - Em cada teste, o mock é reconfigurado com mockImplementation que
 *    inspeciona o SQL recebido (regex) e retorna shapes diferentes.
 *  - Isso simula o estado real do DB sem I/O.
 *
 * NÃO testamos:
 *  - Estratégia 'archive_incomplete' (lógica trivialmente análoga a 'move_incomplete'
 *    e o foco do plano são as 3 estratégias citadas — keep, move, e nome)
 *    → cobertura mínima viável + a regressão crítica é o bug de double-rollover.
 *  - Auto-incremento com rollover_strategy default — coberto indiretamente.
 *
 * NOTA SOBRE nextSprintName: a função NÃO é exportada, então testamos via
 * o nome retornado em INSERT capturado.
 */

const queryMock = vi.fn();

vi.mock('@/lib/db', () => ({
  query: queryMock,
}));

// Helpers pra reduzir boilerplate
function rowResult<T>(rows: T[], rowCount: number = rows.length) {
  return Promise.resolve({ rows, rowCount });
}

interface SprintRowFixture {
  id: string;
  workspace_id: string;
  project_id: string | null;
  name: string;
  goal: string | null;
  end_date: string | null;
  auto_rollover: boolean;
  cadence_days: number | null;
  rollover_strategy: string;
  rolled_over_at: string | null;
}

const SPRINT_BASE: SprintRowFixture = {
  id: 'sprint-old-1',
  workspace_id: 'ws-1',
  project_id: 'proj-1',
  name: 'Sprint 1',
  goal: 'Goal 1',
  end_date: '2026-01-01T00:00:00Z',
  auto_rollover: true,
  cadence_days: 7,
  rollover_strategy: 'move_incomplete',
  rolled_over_at: null,
};

/**
 * Configurador genérico do mock. Aceita override do sprint base e da
 * estratégia. Captura todas as queries em `calls` pra asserts posteriores.
 */
function setupQueryMock(opts: {
  sprintRow?: Partial<SprintRowFixture>;
  movedRowCount?: number;
  newSprintId?: string;
}) {
  const sprint = { ...SPRINT_BASE, ...(opts.sprintRow || {}) };
  const newSprintId = opts.newSprintId || 'sprint-new-1';
  const movedRowCount = opts.movedRowCount ?? 0;

  queryMock.mockImplementation((sql: string, _params?: unknown[]) => {
    // 1) SELECT da sprint atual
    if (/SELECT\s+id,\s*workspace_id,\s*project_id,\s*name/i.test(sql) &&
        /FROM\s+sprints\s+WHERE\s+id\s*=\s*\$1/i.test(sql)) {
      return rowResult([sprint], 1);
    }
    // 2) INSERT da nova sprint → RETURNING id
    if (/INSERT\s+INTO\s+sprints/i.test(sql)) {
      return rowResult([{ id: newSprintId }], 1);
    }
    // 3) UPDATE de tickets (move_incomplete)
    if (/UPDATE\s+tickets\s+SET\s+sprint_id/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: movedRowCount });
    }
    // 4) UPDATE archive_incomplete
    if (/UPDATE\s+tickets\s+SET\s+is_archived\s*=\s*true/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: movedRowCount });
    }
    // 5) UPDATE da sprint marcando rolled_over_at
    if (/UPDATE\s+sprints[\s\S]*rolled_over_at\s*=\s*NOW\(\)/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    // 6) UPDATE de desativação das outras sprints do projeto
    if (/UPDATE\s+sprints\s+SET\s+is_active\s*=\s*false/i.test(sql)) {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    // Fallback inesperado — facilita debug
    throw new Error(`SQL não mockado: ${sql.slice(0, 80)}…`);
  });
}

describe('lib/sprint-rollover — rolloverSprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws "não encontrada" se sprint não existir', async () => {
    queryMock.mockImplementationOnce(() => rowResult([], 0));

    const { rolloverSprint } = await import('@/lib/sprint-rollover');
    await expect(rolloverSprint('inexistente')).rejects.toThrow('Sprint não encontrada');
  });

  it('throws se sprint já foi rolada (rolled_over_at != null)', async () => {
    setupQueryMock({
      sprintRow: { rolled_over_at: '2026-01-15T00:00:00Z' },
    });

    const { rolloverSprint } = await import('@/lib/sprint-rollover');
    await expect(rolloverSprint('sprint-old-1')).rejects.toThrow(
      'Sprint já foi rolada anteriormente'
    );
  });

  it('estratégia "move_incomplete" faz UPDATE em tickets não-done', async () => {
    setupQueryMock({
      sprintRow: { rollover_strategy: 'move_incomplete' },
      movedRowCount: 5,
    });

    const { rolloverSprint } = await import('@/lib/sprint-rollover');
    const result = await rolloverSprint('sprint-old-1');

    expect(result.moved_count).toBe(5);
    expect(result.archived_count).toBe(0);
    expect(result.strategy).toBe('move_incomplete');
    expect(result.new_sprint_id).toBe('sprint-new-1');

    // Verifica que UPDATE tickets SET sprint_id foi chamado
    const updateCalls = queryMock.mock.calls.filter((c) =>
      /UPDATE\s+tickets\s+SET\s+sprint_id/i.test(c[0])
    );
    expect(updateCalls.length).toBe(1);
  });

  it('estratégia "keep_in_place" → moved_count=0 e nenhum UPDATE em tickets', async () => {
    setupQueryMock({
      sprintRow: { rollover_strategy: 'keep_in_place' },
    });

    const { rolloverSprint } = await import('@/lib/sprint-rollover');
    const result = await rolloverSprint('sprint-old-1');

    expect(result.moved_count).toBe(0);
    expect(result.archived_count).toBe(0);
    expect(result.strategy).toBe('keep_in_place');

    // Não deve ter UPDATE em tickets
    const ticketUpdates = queryMock.mock.calls.filter((c) =>
      /UPDATE\s+tickets/i.test(c[0])
    );
    expect(ticketUpdates.length).toBe(0);
  });

  it('estratégia "archive_incomplete" → archived_count > 0', async () => {
    setupQueryMock({
      sprintRow: { rollover_strategy: 'archive_incomplete' },
      movedRowCount: 3,
    });

    const { rolloverSprint } = await import('@/lib/sprint-rollover');
    const result = await rolloverSprint('sprint-old-1');

    expect(result.archived_count).toBe(3);
    expect(result.moved_count).toBe(0);
  });

  describe('auto-incremento de nome', () => {
    /** Captura o nome enviado no INSERT da nova sprint */
    function captureNewSprintName(): string {
      const insertCall = queryMock.mock.calls.find((c) =>
        /INSERT\s+INTO\s+sprints/i.test(c[0])
      );
      if (!insertCall) throw new Error('INSERT da nova sprint não foi chamado');
      // Conforme INSERT no source: 3º parâmetro ($3) é o name
      return (insertCall[1] as unknown[])[2] as string;
    }

    it('"Sprint 1" → "Sprint 2"', async () => {
      setupQueryMock({ sprintRow: { name: 'Sprint 1' } });
      const { rolloverSprint } = await import('@/lib/sprint-rollover');
      await rolloverSprint('sprint-old-1');
      expect(captureNewSprintName()).toBe('Sprint 2');
    });

    it('"Sprint 9" → "Sprint 10" (overflow de dígito)', async () => {
      setupQueryMock({ sprintRow: { name: 'Sprint 9' } });
      const { rolloverSprint } = await import('@/lib/sprint-rollover');
      await rolloverSprint('sprint-old-1');
      expect(captureNewSprintName()).toBe('Sprint 10');
    });

    it('"01 Projeto X" → "02 Projeto X" (padding preservado)', async () => {
      setupQueryMock({ sprintRow: { name: '01 Projeto X' } });
      const { rolloverSprint } = await import('@/lib/sprint-rollover');
      await rolloverSprint('sprint-old-1');
      expect(captureNewSprintName()).toBe('02 Projeto X');
    });

    it('nome sem número → "X (continuação)"', async () => {
      setupQueryMock({ sprintRow: { name: 'Backlog Geral' } });
      const { rolloverSprint } = await import('@/lib/sprint-rollover');
      await rolloverSprint('sprint-old-1');
      expect(captureNewSprintName()).toBe('Backlog Geral (continuação)');
    });
  });

  it('cadence_days NULL → usa default 7 dias na nova end_date', async () => {
    setupQueryMock({
      sprintRow: {
        cadence_days: null,
        end_date: '2026-01-01T00:00:00Z',
      },
    });

    const { rolloverSprint } = await import('@/lib/sprint-rollover');
    await rolloverSprint('sprint-old-1');

    const insertCall = queryMock.mock.calls.find((c) =>
      /INSERT\s+INTO\s+sprints/i.test(c[0])
    );
    const params = insertCall?.[1] as unknown[];
    // start_date = $5, end_date = $6
    const startDate = params[4] as Date;
    const endDate = params[5] as Date;
    const diffDays = (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(7);
  });
});
