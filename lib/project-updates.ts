/**
 * Project Updates helper — gera + persiste status updates semanais por projeto.
 *
 * Usado por:
 *   - Endpoints REST em app/api/projects/[id]/updates (criação manual)
 *   - Cron semanal (devops-eng-3b) que itera todos projetos ativos
 *
 * Decisões:
 *   - Idempotente: ON CONFLICT DO NOTHING via UNIQUE(project_id, period_from, period_to)
 *   - Se ai-status.ts ainda não existir (ai-eng-3b está em paralelo), usa fallback
 *     que monta um summary mínimo a partir dos counts. Não quebra o fluxo.
 *   - Edge case: projeto sem tickets no período => ai_summary tem counts=0 mas
 *     ainda assim cria o registro (PM pode preencher pm_notes manualmente).
 */

import { query } from './db';

export interface ProjectUpdateAISummary {
  completed_count: number;
  overdue_count: number;
  priority_changes: number;
  blockers: string[];
  summary: string;
  risks: string[];
}

export interface SavedProjectUpdate {
  id: string;
  ai_summary: ProjectUpdateAISummary;
}

/**
 * Tenta carregar o módulo de IA dinamicamente. Se ai-eng-3b ainda não criou
 * `lib/ai-status.ts` retornamos null e usamos fallback.
 */
async function tryGenerateAISummary(
  projectId: string,
  periodFrom: Date,
  periodTo: Date
): Promise<ProjectUpdateAISummary | null> {
  try {
    // Import dinâmico para não quebrar build se módulo ainda não existe.
    const mod = await import('./ai-status').catch(() => null);
    if (!mod || typeof (mod as { generateProjectStatusUpdate?: unknown }).generateProjectStatusUpdate !== 'function') {
      return null;
    }
    const fn = (mod as unknown as {
      generateProjectStatusUpdate: (
        projectId: string,
        periodFrom: Date,
        periodTo: Date
      ) => Promise<ProjectUpdateAISummary>;
    }).generateProjectStatusUpdate;
    return await fn(projectId, periodFrom, periodTo);
  } catch {
    return null;
  }
}

/**
 * Fallback: monta summary mínimo direto do banco quando o módulo de IA não
 * está disponível. Garante que o registro sempre é criado.
 */
async function buildFallbackSummary(
  projectId: string,
  periodFrom: Date,
  periodTo: Date
): Promise<ProjectUpdateAISummary> {
  // Tickets concluídos no período (status.is_done = true)
  const completed = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM tickets t
     JOIN statuses s ON s.id = t.status_id
     WHERE t.project_id = $1
       AND s.is_done = true
       AND t.completed_at >= $2
       AND t.completed_at <= $3`,
    [projectId, periodFrom, periodTo]
  );

  // Tickets em atraso (due_date passou e não estão done)
  const overdue = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM tickets t
     LEFT JOIN statuses s ON s.id = t.status_id
     WHERE t.project_id = $1
       AND t.due_date IS NOT NULL
       AND t.due_date < NOW()
       AND (s.is_done IS NULL OR s.is_done = false)
       AND t.is_archived = false`,
    [projectId]
  );

  // Mudanças de prioridade no período (via audit_log se existir)
  let priorityChanges = 0;
  try {
    const pc = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM audit_log
       WHERE entity_type = 'ticket'
         AND action LIKE '%priority%'
         AND created_at >= $1
         AND created_at <= $2
         AND entity_id IN (SELECT id::text FROM tickets WHERE project_id = $3)`,
      [periodFrom, periodTo, projectId]
    );
    priorityChanges = pc.rows[0]?.count ?? 0;
  } catch {
    priorityChanges = 0;
  }

  return {
    completed_count: completed.rows[0]?.count ?? 0,
    overdue_count: overdue.rows[0]?.count ?? 0,
    priority_changes: priorityChanges,
    blockers: [],
    summary: 'Resumo automático indisponível. Preencha pm_notes para complementar.',
    risks: [],
  };
}

/**
 * Gera + salva status update para um projeto na janela [periodFrom, periodTo].
 *
 * @returns o registro criado ou null se falhou (ex: projeto inexistente).
 *          Se a UNIQUE constraint disparar (update já existe na janela),
 *          retorna o registro existente em vez de criar duplicado.
 */
export async function generateAndSaveUpdateForProject(
  projectId: string,
  periodFrom: Date,
  periodTo: Date,
  generatedByCron = true
): Promise<SavedProjectUpdate | null> {
  // 1. Resolver workspace_id do projeto
  const proj = await query<{ workspace_id: string }>(
    `SELECT workspace_id FROM projects WHERE id = $1 AND is_archived = false`,
    [projectId]
  );
  if (!proj.rows[0]) return null;
  const workspaceId = proj.rows[0].workspace_id;

  // 2. Tentar IA, fallback se indisponível
  const aiSummary =
    (await tryGenerateAISummary(projectId, periodFrom, periodTo)) ??
    (await buildFallbackSummary(projectId, periodFrom, periodTo));

  // 3. INSERT idempotente
  const inserted = await query<{ id: string; ai_summary: ProjectUpdateAISummary }>(
    `INSERT INTO project_updates
       (project_id, workspace_id, period_from, period_to, ai_summary, generated_by_cron)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (project_id, period_from, period_to) DO NOTHING
     RETURNING id, ai_summary`,
    [projectId, workspaceId, periodFrom, periodTo, JSON.stringify(aiSummary), generatedByCron]
  );

  if (inserted.rows[0]) {
    return inserted.rows[0];
  }

  // Conflict ocorreu: buscar o existente
  const existing = await query<{ id: string; ai_summary: ProjectUpdateAISummary }>(
    `SELECT id, ai_summary FROM project_updates
     WHERE project_id = $1 AND period_from = $2 AND period_to = $3`,
    [projectId, periodFrom, periodTo]
  );
  return existing.rows[0] ?? null;
}

/**
 * Calcula a janela "última semana" terminando em now.
 * Útil para o caller default e para o cron.
 */
export function lastWeekWindow(now = new Date()): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  return { from, to };
}
