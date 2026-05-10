import OpenAI from 'openai';
import { query } from './db';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const TIMEOUT_MS = 15_000;
const MAX_TICKETS_IN_PROMPT = 30;
const MAX_COMPLETED_LISTED = 15;
const MAX_OVERDUE_LISTED = 10;
const MAX_BLOCKERS_LISTED = 5;
const MAX_TITLE_CHARS = 160;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ===== Tipos públicos =====

export interface ProjectStatusMetrics {
  completed_count: number;
  created_count: number;
  overdue_count: number;
  priority_increased_count: number;
  avg_resolution_hours: number | null;
}

export interface ProjectStatusRisk {
  severity: 'high' | 'medium' | 'low';
  description: string;
  ticket_keys?: string[];
}

export interface ProjectStatusBlocker {
  ticket_key: string;
  title: string;
  reason: string;
}

export interface ProjectStatusSummary {
  period: { from: string; to: string };
  metrics: ProjectStatusMetrics;
  highlights: string[];
  risks: ProjectStatusRisk[];
  blockers: ProjectStatusBlocker[];
  summary: string;
  next_focus: string;
  generated_at: string;
}

// ===== Helpers internos =====

const VALID_SEVERITY: Array<ProjectStatusRisk['severity']> = ['high', 'medium', 'low'];

function isAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function truncate(value: string, max: number): string {
  if (!value) return '';
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

function formatDateBR(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function emptyMetrics(): ProjectStatusMetrics {
  return {
    completed_count: 0,
    created_count: 0,
    overdue_count: 0,
    priority_increased_count: 0,
    avg_resolution_hours: null,
  };
}

function buildFallback(
  periodFrom: Date,
  periodTo: Date,
  metrics: ProjectStatusMetrics,
  reason: string
): ProjectStatusSummary {
  const hasActivity =
    metrics.completed_count > 0 ||
    metrics.created_count > 0 ||
    metrics.overdue_count > 0;
  const summary = hasActivity ? reason : 'Nenhuma atividade registrada no período.';
  return {
    period: { from: periodFrom.toISOString(), to: periodTo.toISOString() },
    metrics,
    highlights: [],
    risks: [],
    blockers: [],
    summary,
    next_focus: '',
    generated_at: new Date().toISOString(),
  };
}

// ===== Tipos internos de query =====

interface TicketRow {
  id: string;
  ticket_key: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  sla_due_at: string | null;
  completed_at: string | null;
  created_at: string;
  is_done: boolean | null;
}

interface BlockerRow {
  ticket_id: string;
  ticket_key: string;
  ticket_title: string;
  blocker_key: string;
  blocker_title: string;
}

interface AvgRow {
  avg_hours: string | null;
}

const PRIORITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

// ===== Coleta de dados =====

async function loadProjectData(
  projectId: string,
  periodFrom: Date,
  periodTo: Date
): Promise<{
  created: TicketRow[];
  completed: TicketRow[];
  overdue: TicketRow[];
  blockers: BlockerRow[];
  metrics: ProjectStatusMetrics;
}> {
  const [createdRes, completedRes, overdueRes, blockersRes, avgRes, priorityChangesRes] =
    await Promise.all([
      query<TicketRow>(
        `SELECT id, ticket_key, title, priority, due_date::text, sla_due_at::text,
                completed_at::text, created_at::text, is_done
           FROM tickets_full
          WHERE project_id = $1
            AND is_archived = false
            AND created_at BETWEEN $2 AND $3
          ORDER BY created_at DESC
          LIMIT 500`,
        [projectId, periodFrom, periodTo]
      ),
      query<TicketRow>(
        `SELECT id, ticket_key, title, priority, due_date::text, sla_due_at::text,
                completed_at::text, created_at::text, is_done
           FROM tickets_full
          WHERE project_id = $1
            AND is_archived = false
            AND completed_at BETWEEN $2 AND $3
          ORDER BY completed_at DESC
          LIMIT 500`,
        [projectId, periodFrom, periodTo]
      ),
      query<TicketRow>(
        `SELECT id, ticket_key, title, priority, due_date::text, sla_due_at::text,
                completed_at::text, created_at::text, is_done
           FROM tickets_full
          WHERE project_id = $1
            AND is_archived = false
            AND completed_at IS NULL
            AND sla_due_at IS NOT NULL
            AND sla_due_at < NOW()
          ORDER BY sla_due_at ASC
          LIMIT 200`,
        [projectId]
      ),
      query<BlockerRow>(
        `SELECT
            tf.id          AS ticket_id,
            tf.ticket_key  AS ticket_key,
            tf.title       AS ticket_title,
            bf.ticket_key  AS blocker_key,
            bf.title       AS blocker_title
           FROM ticket_relations r
           JOIN tickets_full tf ON tf.id = r.source_ticket_id
           JOIN tickets_full bf ON bf.id = r.target_ticket_id
          WHERE r.relation_type = 'blocked_by'
            AND tf.project_id = $1
            AND tf.completed_at IS NULL
            AND tf.is_archived = false
            AND bf.completed_at IS NULL
            AND bf.is_archived = false
          ORDER BY tf.priority DESC NULLS LAST, tf.created_at ASC
          LIMIT 50`,
        [projectId]
      ),
      query<AvgRow>(
        `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600.0)::text AS avg_hours
           FROM tickets
          WHERE project_id = $1
            AND is_archived = false
            AND completed_at BETWEEN $2 AND $3
            AND completed_at >= created_at`,
        [projectId, periodFrom, periodTo]
      ),
      query<{ old_priority: string | null; new_priority: string | null }>(
        `SELECT a.changes->>'old_priority' AS old_priority,
                a.changes->>'new_priority' AS new_priority
           FROM audit_log a
          WHERE a.entity_type = 'ticket'
            AND a.created_at BETWEEN $2 AND $3
            AND a.entity_id IN (SELECT id FROM tickets WHERE project_id = $1)
            AND a.changes ? 'new_priority'
            AND a.changes ? 'old_priority'`,
        [projectId, periodFrom, periodTo]
      ).catch((err) => {
        console.error('[ai-status] audit_log indisponível, priority_increased=0:', err);
        return { rows: [] as Array<{ old_priority: string | null; new_priority: string | null }> };
      }),
    ]);

    let priorityIncreasedCount = 0;
    for (const row of priorityChangesRes.rows) {
      const oldR = PRIORITY_RANK[String(row.old_priority || '').toLowerCase()] ?? 0;
      const newR = PRIORITY_RANK[String(row.new_priority || '').toLowerCase()] ?? 0;
      if (newR > oldR) priorityIncreasedCount += 1;
    }

  const avgRaw = avgRes.rows[0]?.avg_hours;
  const avgHours = avgRaw === null || avgRaw === undefined ? null : Number(Number(avgRaw).toFixed(2));

  const metrics: ProjectStatusMetrics = {
    created_count: createdRes.rows.length,
    completed_count: completedRes.rows.length,
    overdue_count: overdueRes.rows.length,
    priority_increased_count: priorityIncreasedCount,
    avg_resolution_hours: avgHours !== null && Number.isFinite(avgHours) ? avgHours : null,
  };

  return {
    created: createdRes.rows,
    completed: completedRes.rows,
    overdue: overdueRes.rows,
    blockers: blockersRes.rows,
    metrics,
  };
}

// ===== Seleção de tickets relevantes =====

function rankTickets(rows: TicketRow[]): TicketRow[] {
  return [...rows].sort((a, b) => {
    const ra = PRIORITY_RANK[String(a.priority || '').toLowerCase()] ?? 0;
    const rb = PRIORITY_RANK[String(b.priority || '').toLowerCase()] ?? 0;
    if (rb !== ra) return rb - ra;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
}

// ===== Prompt =====

function buildPrompt(
  periodFrom: Date,
  periodTo: Date,
  metrics: ProjectStatusMetrics,
  completed: TicketRow[],
  overdue: TicketRow[],
  blockers: BlockerRow[]
): string {
  const completedTop = rankTickets(completed).slice(0, MAX_COMPLETED_LISTED);
  const overdueTop = rankTickets(overdue).slice(0, MAX_OVERDUE_LISTED);
  const blockersTop = blockers.slice(0, MAX_BLOCKERS_LISTED);

  const completedBlock = completedTop.length
    ? completedTop
        .map(
          (t) =>
            `- ${t.ticket_key} | ${truncate(t.title || '(sem título)', MAX_TITLE_CHARS)} | prioridade=${t.priority || 'n/a'}`
        )
        .join('\n')
    : '(nenhum)';

  const overdueBlock = overdueTop.length
    ? overdueTop
        .map((t) => {
          const due = t.sla_due_at || t.due_date || 'n/a';
          return `- ${t.ticket_key} | ${truncate(t.title || '(sem título)', MAX_TITLE_CHARS)} | prioridade=${t.priority || 'n/a'} | due=${due}`;
        })
        .join('\n')
    : '(nenhum)';

  const blockersBlock = blockersTop.length
    ? blockersTop
        .map(
          (b) =>
            `- ${b.ticket_key} | ${truncate(b.ticket_title || '(sem título)', MAX_TITLE_CHARS)} | bloqueado por ${b.blocker_key} (${truncate(b.blocker_title || '', 80)})`
        )
        .join('\n')
    : '(nenhum)';

  const avgStr =
    metrics.avg_resolution_hours === null ? 'n/a' : `${metrics.avg_resolution_hours}h`;

  return `Você é um assistente de PM analisando um projeto de software.

Período: ${formatDateBR(periodFrom)} a ${formatDateBR(periodTo)}

Métricas calculadas (use exatamente esses números):
- Tickets criados: ${metrics.created_count}
- Tickets concluídos: ${metrics.completed_count}
- Tickets atrasados (SLA): ${metrics.overdue_count}
- Mudanças de prioridade pra cima: ${metrics.priority_increased_count}
- Tempo médio de resolução: ${avgStr}

Tickets concluídos (top ${MAX_COMPLETED_LISTED}):
${completedBlock}

Tickets atrasados (top ${MAX_OVERDUE_LISTED}):
${overdueBlock}

Bloqueadores ativos (top ${MAX_BLOCKERS_LISTED}):
${blockersBlock}

Escreva resumo de status em PT-BR. Retorne APENAS JSON válido com este schema:
{
  "summary": "2-3 parágrafos: o que aconteceu, contexto, ritmo",
  "highlights": ["conquista 1", "conquista 2", "conquista 3 (max 5)"],
  "risks": [{"severity":"high|medium|low","description":"...","ticket_keys":["BAH-X"]}],
  "next_focus": "1 frase: o que priorizar próxima semana"
}

Tom: factual, direto. Não invente número. Não adicione bloqueadores ou riscos sem evidência nos tickets listados.`;
}

interface RawAiResponse {
  summary?: unknown;
  highlights?: unknown;
  risks?: unknown;
  next_focus?: unknown;
}

function normalizeHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw.trim();
    if (cleaned) out.push(truncate(cleaned, 240));
    if (out.length >= 5) break;
  }
  return out;
}

function normalizeRisks(value: unknown, validKeys: Set<string>): ProjectStatusRisk[] {
  if (!Array.isArray(value)) return [];
  const out: ProjectStatusRisk[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const sev = VALID_SEVERITY.includes(r.severity as ProjectStatusRisk['severity'])
      ? (r.severity as ProjectStatusRisk['severity'])
      : 'medium';
    const desc = typeof r.description === 'string' ? truncate(r.description.trim(), 400) : '';
    if (!desc) continue;
    let keys: string[] | undefined;
    if (Array.isArray(r.ticket_keys)) {
      const filtered = r.ticket_keys
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.trim())
        .filter((k) => k && validKeys.has(k));
      keys = filtered.length ? filtered.slice(0, 5) : undefined;
    }
    out.push({ severity: sev, description: desc, ticket_keys: keys });
    if (out.length >= 8) break;
  }
  return out;
}

async function callOpenAi(prompt: string): Promise<string> {
  const completion = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 1000,
      response_format: { type: 'json_object' as const },
      messages: [{ role: 'user', content: prompt }],
    },
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  return completion.choices[0]?.message?.content || '';
}

// ===== API pública =====

/**
 * Gera um status update semanal de projeto para popular `project_updates.ai_summary`.
 * Mistura métricas calculadas em SQL/JS com narrativa de IA.
 *
 * Sempre retorna estrutura válida — em caso de falha de IA cai pra fallback
 * com métricas reais e summary indicando indisponibilidade.
 */
export async function generateProjectStatusUpdate(
  projectId: string,
  periodFrom: Date,
  periodTo: Date
): Promise<ProjectStatusSummary> {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('projectId obrigatório');
  }
  if (!(periodFrom instanceof Date) || Number.isNaN(periodFrom.getTime())) {
    throw new Error('periodFrom inválido');
  }
  if (!(periodTo instanceof Date) || Number.isNaN(periodTo.getTime())) {
    throw new Error('periodTo inválido');
  }
  if (periodTo.getTime() <= periodFrom.getTime()) {
    throw new Error('periodTo deve ser posterior a periodFrom');
  }

  let data: Awaited<ReturnType<typeof loadProjectData>>;
  try {
    data = await loadProjectData(projectId, periodFrom, periodTo);
  } catch (err) {
    console.error('[ai-status] loadProjectData falhou:', err);
    return buildFallback(
      periodFrom,
      periodTo,
      emptyMetrics(),
      'Erro ao carregar dados do projeto.'
    );
  }

  const { created, completed, overdue, blockers, metrics } = data;

  const blockersList: ProjectStatusBlocker[] = blockers.slice(0, MAX_BLOCKERS_LISTED).map((b) => ({
    ticket_key: b.ticket_key,
    title: truncate(b.ticket_title || '', 200),
    reason: `Bloqueado por ${b.blocker_key}${b.blocker_title ? ` — ${truncate(b.blocker_title, 120)}` : ''}`,
  }));

  const noActivity =
    metrics.created_count === 0 &&
    metrics.completed_count === 0 &&
    metrics.overdue_count === 0 &&
    blockers.length === 0;

  if (noActivity) {
    return {
      period: { from: periodFrom.toISOString(), to: periodTo.toISOString() },
      metrics,
      highlights: [],
      risks: [],
      blockers: [],
      summary: 'Nenhuma atividade registrada no período.',
      next_focus: '',
      generated_at: new Date().toISOString(),
    };
  }

  if (!isAvailable()) {
    return buildFallback(
      periodFrom,
      periodTo,
      metrics,
      'Resumo automático indisponível (IA não configurada).'
    );
  }

  // Cap de tickets pra prompt: usamos somente os listados (já é < 30).
  // Se total relevante > 200, garantimos que rankeamos pra pegar os mais críticos.
  const totalRelevant = completed.length + overdue.length;
  if (totalRelevant > 200) {
    // já limitamos via slice no buildPrompt, só log informativo (sem console.log)
  }

  let raw: string;
  try {
    raw = await callOpenAi(buildPrompt(periodFrom, periodTo, metrics, completed, overdue, blockers));
  } catch (err) {
    console.error('[ai-status] chamada OpenAI falhou:', err);
    const fb = buildFallback(periodFrom, periodTo, metrics, 'Resumo automático indisponível (falha na IA).');
    return { ...fb, blockers: blockersList };
  }

  let parsed: RawAiResponse;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('[ai-status] JSON inválido da IA:', err);
    const fb = buildFallback(periodFrom, periodTo, metrics, 'Resumo automático indisponível (resposta inválida da IA).');
    return { ...fb, blockers: blockersList };
  }

  // Conjunto de keys válidas (universo dos tickets analisados)
  const validKeys = new Set<string>();
  for (const t of [...created, ...completed, ...overdue]) validKeys.add(t.ticket_key);
  for (const b of blockers) {
    validKeys.add(b.ticket_key);
    validKeys.add(b.blocker_key);
  }

  const summaryText = typeof parsed.summary === 'string' ? truncate(parsed.summary.trim(), 4_000) : '';
  const nextFocus = typeof parsed.next_focus === 'string' ? truncate(parsed.next_focus.trim(), 400) : '';

  return {
    period: { from: periodFrom.toISOString(), to: periodTo.toISOString() },
    metrics,
    highlights: normalizeHighlights(parsed.highlights),
    risks: normalizeRisks(parsed.risks, validKeys),
    blockers: blockersList,
    summary: summaryText || 'Sem resumo gerado.',
    next_focus: nextFocus,
    generated_at: new Date().toISOString(),
  };
}
