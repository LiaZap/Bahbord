/**
 * Sprint Rollover helper — cria nova sprint a partir de uma sprint atual,
 * aplicando a estratégia configurada para os tickets incompletos.
 *
 * Usado por:
 *   - Endpoint manual POST /api/sprints/[id]/rollover (admin/owner)
 *   - Cron diário (devops-eng-3b) que processa sprints com auto_rollover=true
 *     cuja end_date passou.
 *
 * Estratégias de rollover:
 *   - 'move_incomplete' (default): tickets não-done movidos para a nova sprint
 *   - 'keep_in_place': nada faz, ticket fica vinculado à sprint antiga
 *   - 'archive_incomplete': tickets não-done são arquivados
 *
 * Edge cases tratados:
 *   - cadence_days NULL: usa default 7 dias para evitar nova sprint sem fim.
 *   - end_date NULL na sprint atual: usa NOW() como base para start da nova.
 *   - Sprint já marcada como rolled_over_at: aborta com erro (idempotência).
 *   - Sem tickets incompletos: retorna moved_count/archived_count = 0.
 */

import { query } from './db';

export interface RolloverResult {
  old_sprint_id: string;
  new_sprint_id: string;
  moved_count: number;
  archived_count: number;
  strategy: string;
}

interface SprintRow {
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

const DEFAULT_CADENCE_DAYS = 7;

/**
 * Auto-incrementa nome de sprint no padrão "Sprint N", "01 Projeto", etc.
 * Detecta padrões numéricos no início ou no fim do nome.
 */
function nextSprintName(currentName: string): string {
  // Match "Sprint N" no fim
  const sprintN = currentName.match(/^(.*?)(\d+)$/);
  if (sprintN) {
    const prefix = sprintN[1];
    const n = parseInt(sprintN[2], 10);
    const padded = String(n + 1).padStart(sprintN[2].length, '0');
    return `${prefix}${padded}`;
  }
  // Match "NN <resto>" no começo (ex: "01 Projeto X" -> "02 Projeto X")
  const leadingNum = currentName.match(/^(\d+)(\s+)(.+)$/);
  if (leadingNum) {
    const n = parseInt(leadingNum[1], 10);
    const padded = String(n + 1).padStart(leadingNum[1].length, '0');
    return `${padded}${leadingNum[2]}${leadingNum[3]}`;
  }
  // Fallback: adicionar "(continuação)"
  return `${currentName} (continuação)`;
}

/**
 * Executa o rollover de uma sprint.
 *
 * @throws Error se sprint não existe ou já foi rolada.
 */
export async function rolloverSprint(sprintId: string): Promise<RolloverResult> {
  // 1. Carregar sprint atual com lock
  const cur = await query<SprintRow>(
    `SELECT id, workspace_id, project_id, name, goal, end_date,
            auto_rollover, cadence_days, rollover_strategy, rolled_over_at
     FROM sprints WHERE id = $1`,
    [sprintId]
  );
  if (!cur.rows[0]) {
    throw new Error('Sprint não encontrada');
  }
  const current = cur.rows[0];

  if (current.rolled_over_at) {
    throw new Error('Sprint já foi rolada anteriormente');
  }

  // 2. Determinar datas + estratégia da nova sprint
  const cadenceDays = current.cadence_days ?? DEFAULT_CADENCE_DAYS;
  const startDate = current.end_date ? new Date(current.end_date) : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + cadenceDays);

  const strategy = current.rollover_strategy || 'move_incomplete';
  const newName = nextSprintName(current.name);

  // 3. Criar nova sprint herdando config
  const newSprint = await query<{ id: string }>(
    `INSERT INTO sprints
       (workspace_id, project_id, name, goal, start_date, end_date, is_active,
        auto_rollover, cadence_days, rollover_strategy, parent_sprint_id)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
     RETURNING id`,
    [
      current.workspace_id,
      current.project_id,
      newName,
      current.goal,
      startDate,
      endDate,
      current.auto_rollover,
      current.cadence_days,
      strategy,
      current.id,
    ]
  );
  const newSprintId = newSprint.rows[0].id;

  // 4. Aplicar estratégia aos tickets incompletos
  let movedCount = 0;
  let archivedCount = 0;

  if (strategy === 'move_incomplete') {
    const moved = await query(
      `UPDATE tickets
         SET sprint_id = $1
       WHERE sprint_id = $2
         AND id IN (
           SELECT t.id FROM tickets t
           LEFT JOIN statuses s ON s.id = t.status_id
           WHERE t.sprint_id = $2
             AND (s.is_done IS NULL OR s.is_done = false)
             AND t.is_archived = false
         )`,
      [newSprintId, current.id]
    );
    movedCount = moved.rowCount ?? 0;
  } else if (strategy === 'archive_incomplete') {
    const archived = await query(
      `UPDATE tickets
         SET is_archived = true
       WHERE sprint_id = $1
         AND id IN (
           SELECT t.id FROM tickets t
           LEFT JOIN statuses s ON s.id = t.status_id
           WHERE t.sprint_id = $1
             AND (s.is_done IS NULL OR s.is_done = false)
             AND t.is_archived = false
         )`,
      [current.id]
    );
    archivedCount = archived.rowCount ?? 0;
  }
  // 'keep_in_place': nada faz

  // 5. Marcar sprint atual como rolada + desativar
  await query(
    `UPDATE sprints
       SET is_active = false,
           rolled_over_at = NOW(),
           updated_at = NOW()
     WHERE id = $1`,
    [current.id]
  );

  // Garantir que apenas a nova sprint do projeto está ativa
  if (current.project_id) {
    await query(
      `UPDATE sprints SET is_active = false
       WHERE project_id = $1 AND id <> $2 AND is_active = true`,
      [current.project_id, newSprintId]
    );
  }

  return {
    old_sprint_id: current.id,
    new_sprint_id: newSprintId,
    moved_count: movedCount,
    archived_count: archivedCount,
    strategy,
  };
}
