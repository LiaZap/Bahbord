import { query } from './db';

export interface InitiativeProgress {
  percentage: number;           // 0–100, ponderado por weight de cada project
  completed_tickets: number;    // soma simples de tickets done (sem peso)
  total_tickets: number;        // soma simples de tickets totais
  projects_count: number;       // qtd de projects vinculados (não-arquivados)
}

export type HealthStatus = 'on_track' | 'at_risk' | 'off_track' | 'completed' | 'archived';

/**
 * Calcula progresso ponderado de uma initiative.
 *
 * Estratégia:
 *   1. Para cada project vinculado (não-arquivado), pegamos:
 *        - total_tickets, completed_tickets (via JOIN com statuses.is_done — nunca t.is_done)
 *        - weight do vínculo
 *   2. percentage = SUM(project_pct * weight) / SUM(weight)
 *      onde project_pct = completed/total (0 se total=0).
 *
 * Edge cases:
 *   - Initiative sem projects → percentage=0, projects_count=0
 *   - Project sem tickets → entra como 0% (não enviesa positivamente)
 *   - Project arquivado → ignorado completamente (não deve influenciar meta viva)
 *   - SUM(weight) = 0 (todos pesos zerados, improvável) → percentage=0 pra evitar divisão por zero
 */
export async function computeInitiativeProgress(initiativeId: string): Promise<InitiativeProgress> {
  const result = await query<{
    project_id: string;
    weight: number;
    total: string;
    completed: string;
  }>(
    `SELECT
       ip.project_id,
       COALESCE(ip.weight, 1) AS weight,
       COUNT(t.id)::int AS total,
       COUNT(t.id) FILTER (WHERE COALESCE(s.is_done, false) = true)::int AS completed
     FROM initiative_projects ip
     JOIN projects p ON p.id = ip.project_id AND p.is_archived = false
     LEFT JOIN tickets t ON t.project_id = ip.project_id
     LEFT JOIN statuses s ON s.id = t.status_id
     WHERE ip.initiative_id = $1
     GROUP BY ip.project_id, ip.weight`,
    [initiativeId],
  );

  const rows = result.rows;
  if (rows.length === 0) {
    return { percentage: 0, completed_tickets: 0, total_tickets: 0, projects_count: 0 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  let completedTickets = 0;
  let totalTickets = 0;

  for (const row of rows) {
    const total = Number(row.total) || 0;
    const completed = Number(row.completed) || 0;
    const weight = Number(row.weight) || 1;

    const pct = total === 0 ? 0 : (completed / total) * 100;
    weightedSum += pct * weight;
    totalWeight += weight;
    completedTickets += completed;
    totalTickets += total;
  }

  const percentage = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);

  return {
    percentage,
    completed_tickets: completedTickets,
    total_tickets: totalTickets,
    projects_count: rows.length,
  };
}

/**
 * Sugere health a partir do progresso + target_date. Lógica determinística
 * (sem IA). Não altera nada no DB — apenas devolve a sugestão pra a UI exibir
 * ao admin, que decide se aplica ou não.
 *
 * Regras:
 *   - target_date passou e progress < 100 → off_track
 *   - target_date em <30 dias e progress < 70% → at_risk
 *   - Caso contrário → on_track
 *
 * Se target_date é null → sempre on_track (sem prazo, sem como avaliar risco).
 */
export function suggestHealthFromProgress(
  progress: InitiativeProgress,
  targetDate?: Date | string | null,
): 'on_track' | 'at_risk' | 'off_track' {
  if (!targetDate) return 'on_track';

  const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
  if (isNaN(target.getTime())) return 'on_track';

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntil = Math.floor((target.getTime() - now.getTime()) / msPerDay);

  if (daysUntil < 0 && progress.percentage < 100) return 'off_track';
  if (daysUntil < 30 && progress.percentage < 70) return 'at_risk';
  return 'on_track';
}
