import { query } from './db';

/**
 * Catálogo fechado de queries pré-aprovadas que o assistente IA pode executar
 * via function calling.
 *
 * REGRA DE OURO: o LLM NUNCA emite SQL livre. Ele apenas escolhe o nome de
 * uma função deste catálogo e fornece parâmetros tipados. O SQL é fixo,
 * parametrizado, e SEMPRE filtrado por workspace_id (multi-tenant safe).
 *
 * Para adicionar uma nova capacidade ao assistente:
 *  1. Adicione uma entry em QUERY_CATALOG.
 *  2. SQL DEVE filtrar por `WHERE workspace_id = $1` (workspaceId vem do auth,
 *     NUNCA dos params do LLM).
 *  3. Validação de tipos primitivos (string/number/uuid/date) é feita em
 *     coerceParam() — qualquer parâmetro fora do schema vira null.
 *  4. LIMITs são hardcoded (default 20, máximo 100). LLM não controla.
 */

export type AiParamType = 'string' | 'number' | 'uuid' | 'date';

export interface AiParamDef {
  type: AiParamType;
  description: string;
  required?: boolean;
}

export interface AiQueryDef {
  name: string;
  description: string;
  params: Record<string, AiParamDef>;
  execute: (
    params: Record<string, unknown>,
    workspaceId: string,
  ) => Promise<{ columns: string[]; rows: unknown[][] }>;
}

// ---------------------------------------------------------------------------
// Helpers de validação de parâmetros (defesa-em-profundidade contra alucinação)
// ---------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

function coerceParam(raw: unknown, def: AiParamDef): string | number | null {
  if (raw === undefined || raw === null) return null;
  switch (def.type) {
    case 'uuid': {
      const s = String(raw).trim();
      return UUID_RE.test(s) ? s : null;
    }
    case 'date': {
      const s = String(raw).trim();
      if (!ISO_DATE_RE.test(s)) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : s;
    }
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case 'string':
    default: {
      const s = String(raw).trim();
      return s.length === 0 ? null : s.slice(0, 200);
    }
  }
}

function clampLimit(raw: unknown, fallback = 20, max = 100): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.floor(n));
}

function clampPeriod(raw: unknown, fallback = 30, max = 365): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.floor(n));
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------
export const QUERY_CATALOG: AiQueryDef[] = [
  {
    name: 'tickets_by_status',
    description: 'Conta tickets agrupados por status no workspace (ignora arquivados).',
    params: {},
    async execute(_params, workspaceId) {
      const r = await query<{ status: string | null; count: number }>(
        `SELECT s.name AS status, COUNT(t.id)::int AS count
         FROM tickets t
         LEFT JOIN statuses s ON s.id = t.status_id
         WHERE t.workspace_id = $1 AND t.is_archived = false
         GROUP BY s.name
         ORDER BY count DESC`,
        [workspaceId],
      );
      return {
        columns: ['status', 'count'],
        rows: r.rows.map((x) => [x.status ?? '(sem status)', x.count]),
      };
    },
  },

  {
    name: 'tickets_by_priority',
    description: 'Conta tickets agrupados por prioridade (urgent/high/medium/low) no workspace.',
    params: {},
    async execute(_params, workspaceId) {
      const r = await query<{ priority: string; count: number }>(
        `SELECT t.priority, COUNT(t.id)::int AS count
         FROM tickets t
         WHERE t.workspace_id = $1 AND t.is_archived = false
         GROUP BY t.priority
         ORDER BY CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5 END`,
        [workspaceId],
      );
      return {
        columns: ['priority', 'count'],
        rows: r.rows.map((x) => [x.priority, x.count]),
      };
    },
  },

  {
    name: 'tickets_assigned_to_member',
    description:
      'Lista tickets em aberto atribuídos a um membro específico, ordenados por data de vencimento.',
    params: {
      member_id: { type: 'uuid', description: 'UUID do membro', required: true },
      limit: { type: 'number', description: 'Máx tickets retornados (default 20, máx 100)' },
    },
    async execute(params, workspaceId) {
      const memberId = coerceParam(params.member_id, { type: 'uuid', description: '' });
      if (!memberId) throw new Error('member_id inválido');
      const limit = clampLimit(params.limit);
      const r = await query<{
        ticket_key: string | null;
        title: string;
        status_name: string | null;
        priority: string;
        due_date: Date | null;
      }>(
        `SELECT ticket_key, title, status_name, priority, due_date
         FROM tickets_full
         WHERE workspace_id = $1
           AND assignee_id = $2
           AND is_archived = false
           AND COALESCE(is_done, false) = false
         ORDER BY due_date NULLS LAST
         LIMIT $3`,
        [workspaceId, memberId, limit],
      );
      return {
        columns: ['key', 'title', 'status', 'priority', 'due_date'],
        rows: r.rows.map((x) => [x.ticket_key, x.title, x.status_name, x.priority, x.due_date]),
      };
    },
  },

  {
    name: 'tickets_overdue',
    description:
      'Lista tickets atrasados (due_date no passado, não concluídos, não arquivados). Ordenados pelos mais atrasados primeiro.',
    params: {
      limit: { type: 'number', description: 'Máx tickets retornados (default 20, máx 100)' },
    },
    async execute(params, workspaceId) {
      const limit = clampLimit(params.limit);
      const r = await query<{
        ticket_key: string | null;
        title: string;
        status_name: string | null;
        priority: string;
        due_date: Date | null;
        assignee_name: string | null;
      }>(
        `SELECT ticket_key, title, status_name, priority, due_date, assignee_name
         FROM tickets_full
         WHERE workspace_id = $1
           AND is_archived = false
           AND COALESCE(is_done, false) = false
           AND due_date IS NOT NULL
           AND due_date < NOW()
         ORDER BY due_date ASC
         LIMIT $2`,
        [workspaceId, limit],
      );
      return {
        columns: ['key', 'title', 'status', 'priority', 'due_date', 'assignee'],
        rows: r.rows.map((x) => [
          x.ticket_key,
          x.title,
          x.status_name,
          x.priority,
          x.due_date,
          x.assignee_name,
        ]),
      };
    },
  },

  {
    name: 'tickets_by_project',
    description:
      'Conta tickets agrupados por projeto (não arquivados). Útil pra ver onde está concentrado o trabalho.',
    params: {},
    async execute(_params, workspaceId) {
      const r = await query<{
        project_name: string | null;
        total: number;
        done: number;
      }>(
        `SELECT
           p.name AS project_name,
           COUNT(t.id)::int AS total,
           COUNT(t.id) FILTER (WHERE s.is_done = true)::int AS done
         FROM tickets t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN statuses s ON s.id = t.status_id
         WHERE t.workspace_id = $1 AND t.is_archived = false
         GROUP BY p.name
         ORDER BY total DESC`,
        [workspaceId],
      );
      return {
        columns: ['project', 'total', 'done'],
        rows: r.rows.map((x) => [x.project_name ?? '(sem projeto)', x.total, x.done]),
      };
    },
  },

  {
    name: 'tickets_in_project',
    description: 'Lista tickets em aberto de um projeto específico.',
    params: {
      project_id: { type: 'uuid', description: 'UUID do projeto', required: true },
      limit: { type: 'number', description: 'Máx tickets retornados (default 20, máx 100)' },
    },
    async execute(params, workspaceId) {
      const projectId = coerceParam(params.project_id, { type: 'uuid', description: '' });
      if (!projectId) throw new Error('project_id inválido');
      const limit = clampLimit(params.limit);
      const r = await query<{
        ticket_key: string | null;
        title: string;
        status_name: string | null;
        priority: string;
        assignee_name: string | null;
        due_date: Date | null;
      }>(
        `SELECT ticket_key, title, status_name, priority, assignee_name, due_date
         FROM tickets_full
         WHERE workspace_id = $1
           AND project_id = $2
           AND is_archived = false
           AND COALESCE(is_done, false) = false
         ORDER BY priority, due_date NULLS LAST
         LIMIT $3`,
        [workspaceId, projectId, limit],
      );
      return {
        columns: ['key', 'title', 'status', 'priority', 'assignee', 'due_date'],
        rows: r.rows.map((x) => [
          x.ticket_key,
          x.title,
          x.status_name,
          x.priority,
          x.assignee_name,
          x.due_date,
        ]),
      };
    },
  },

  {
    name: 'sprints_active',
    description: 'Lista sprints ativos no workspace com seus projetos e datas.',
    params: {},
    async execute(_params, workspaceId) {
      const r = await query<{
        id: string;
        name: string;
        project_name: string | null;
        start_date: Date | null;
        end_date: Date | null;
      }>(
        `SELECT sp.id, sp.name, p.name AS project_name, sp.start_date, sp.end_date
         FROM sprints sp
         LEFT JOIN projects p ON p.id = sp.project_id
         WHERE sp.workspace_id = $1
           AND sp.is_active = true
         ORDER BY sp.end_date NULLS LAST`,
        [workspaceId],
      );
      return {
        columns: ['id', 'name', 'project', 'start_date', 'end_date'],
        rows: r.rows.map((x) => [x.id, x.name, x.project_name, x.start_date, x.end_date]),
      };
    },
  },

  {
    name: 'workload_summary',
    description:
      'Distribuição de carga de trabalho: quantos tickets em aberto cada membro tem, agrupado por prioridade.',
    params: {},
    async execute(_params, workspaceId) {
      const r = await query<{
        assignee_name: string | null;
        urgent: number;
        high: number;
        medium: number;
        low: number;
        total: number;
      }>(
        `SELECT
           assignee_name,
           COUNT(*) FILTER (WHERE priority = 'urgent')::int AS urgent,
           COUNT(*) FILTER (WHERE priority = 'high')::int   AS high,
           COUNT(*) FILTER (WHERE priority = 'medium')::int AS medium,
           COUNT(*) FILTER (WHERE priority = 'low')::int    AS low,
           COUNT(*)::int                                    AS total
         FROM tickets_full
         WHERE workspace_id = $1
           AND is_archived = false
           AND COALESCE(is_done, false) = false
           AND assignee_id IS NOT NULL
         GROUP BY assignee_name
         ORDER BY total DESC
         LIMIT 50`,
        [workspaceId],
      );
      return {
        columns: ['assignee', 'urgent', 'high', 'medium', 'low', 'total'],
        rows: r.rows.map((x) => [
          x.assignee_name,
          x.urgent,
          x.high,
          x.medium,
          x.low,
          x.total,
        ]),
      };
    },
  },

  {
    name: 'time_logged_by_period',
    description:
      'Total de horas apontadas por membro nos últimos N dias (default 30, máx 365). Inclui billable e non-billable.',
    params: {
      days: { type: 'number', description: 'Janela em dias (default 30, máx 365)' },
    },
    async execute(params, workspaceId) {
      const days = clampPeriod(params.days);
      const r = await query<{
        member_name: string | null;
        total_minutes: number;
        billable_minutes: number;
        entry_count: number;
      }>(
        `SELECT
           m.display_name AS member_name,
           COALESCE(SUM(te.duration_minutes), 0)::int AS total_minutes,
           COALESCE(SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END), 0)::int AS billable_minutes,
           COUNT(te.id)::int AS entry_count
         FROM time_entries te
         JOIN members m ON m.id = te.member_id
         WHERE m.workspace_id = $1
           AND te.is_running = false
           AND te.started_at > NOW() - ($2 || ' days')::interval
         GROUP BY m.display_name
         ORDER BY total_minutes DESC
         LIMIT 50`,
        [workspaceId, days],
      );
      return {
        columns: ['member', 'total_minutes', 'billable_minutes', 'entries'],
        rows: r.rows.map((x) => [
          x.member_name,
          x.total_minutes,
          x.billable_minutes,
          x.entry_count,
        ]),
      };
    },
  },

  {
    name: 'recent_tickets',
    description:
      'Lista os tickets criados mais recentemente (não arquivados). Útil pra ver o que entrou na fila.',
    params: {
      limit: { type: 'number', description: 'Máx tickets retornados (default 20, máx 100)' },
    },
    async execute(params, workspaceId) {
      const limit = clampLimit(params.limit);
      const r = await query<{
        ticket_key: string | null;
        title: string;
        status_name: string | null;
        priority: string;
        reporter_name: string | null;
        created_at: Date;
      }>(
        `SELECT ticket_key, title, status_name, priority, reporter_name, created_at
         FROM tickets_full
         WHERE workspace_id = $1 AND is_archived = false
         ORDER BY created_at DESC
         LIMIT $2`,
        [workspaceId, limit],
      );
      return {
        columns: ['key', 'title', 'status', 'priority', 'reporter', 'created_at'],
        rows: r.rows.map((x) => [
          x.ticket_key,
          x.title,
          x.status_name,
          x.priority,
          x.reporter_name,
          x.created_at,
        ]),
      };
    },
  },

  {
    name: 'audit_recent_actions',
    description:
      'Lista as ações registradas no audit log nos últimos N dias (default 7, máx 90). Útil pra investigar mudanças de membro/projeto/role.',
    params: {
      days: { type: 'number', description: 'Janela em dias (default 7, máx 90)' },
      limit: { type: 'number', description: 'Máx eventos retornados (default 50, máx 100)' },
    },
    async execute(params, workspaceId) {
      const days = clampPeriod(params.days, 7, 90);
      const limit = clampLimit(params.limit, 50);
      const r = await query<{
        action: string;
        entity_type: string;
        entity_id: string | null;
        actor_name: string | null;
        ip_address: string | null;
        created_at: Date;
      }>(
        `SELECT al.action, al.entity_type, al.entity_id,
                m.display_name AS actor_name,
                al.ip_address, al.created_at
         FROM audit_log al
         LEFT JOIN members m ON m.id = al.actor_id
         WHERE al.workspace_id = $1
           AND al.created_at > NOW() - ($2 || ' days')::interval
         ORDER BY al.created_at DESC
         LIMIT $3`,
        [workspaceId, days, limit],
      );
      return {
        columns: ['action', 'entity_type', 'entity_id', 'actor', 'ip', 'when'],
        rows: r.rows.map((x) => [
          x.action,
          x.entity_type,
          x.entity_id,
          x.actor_name,
          x.ip_address,
          x.created_at,
        ]),
      };
    },
  },

  {
    name: 'tickets_completed_in_period',
    description:
      'Conta tickets concluídos nos últimos N dias (default 30, máx 365), agrupados por membro responsável.',
    params: {
      days: { type: 'number', description: 'Janela em dias (default 30, máx 365)' },
    },
    async execute(params, workspaceId) {
      const days = clampPeriod(params.days);
      const r = await query<{ assignee_name: string | null; completed: number }>(
        `SELECT assignee_name, COUNT(*)::int AS completed
         FROM tickets_full
         WHERE workspace_id = $1
           AND completed_at IS NOT NULL
           AND completed_at > NOW() - ($2 || ' days')::interval
         GROUP BY assignee_name
         ORDER BY completed DESC
         LIMIT 50`,
        [workspaceId, days],
      );
      return {
        columns: ['assignee', 'completed'],
        rows: r.rows.map((x) => [x.assignee_name ?? '(sem responsável)', x.completed]),
      };
    },
  },

  {
    name: 'list_members',
    description:
      'Lista membros do workspace com role e status de aprovação. Útil pra encontrar UUIDs antes de chamar tickets_assigned_to_member.',
    params: {},
    async execute(_params, workspaceId) {
      const r = await query<{
        id: string;
        display_name: string;
        email: string | null;
        role: string;
        is_approved: boolean;
      }>(
        `SELECT m.id, m.display_name, m.email,
                COALESCE(orr.role, 'viewer') AS role,
                m.is_approved
         FROM members m
         LEFT JOIN org_roles orr ON orr.member_id = m.id AND orr.workspace_id = m.workspace_id
         WHERE m.workspace_id = $1
         ORDER BY m.display_name
         LIMIT 100`,
        [workspaceId],
      );
      return {
        columns: ['id', 'name', 'email', 'role', 'approved'],
        rows: r.rows.map((x) => [x.id, x.display_name, x.email, x.role, x.is_approved]),
      };
    },
  },

  {
    name: 'list_projects',
    description:
      'Lista projetos do workspace (não arquivados). Útil pra encontrar UUIDs antes de chamar tickets_in_project.',
    params: {},
    async execute(_params, workspaceId) {
      const r = await query<{ id: string; name: string; prefix: string | null }>(
        `SELECT id, name, prefix
         FROM projects
         WHERE workspace_id = $1
           AND COALESCE(is_archived, false) = false
         ORDER BY name
         LIMIT 100`,
        [workspaceId],
      );
      return {
        columns: ['id', 'name', 'prefix'],
        rows: r.rows.map((x) => [x.id, x.name, x.prefix]),
      };
    },
  },
];

/**
 * Serializa o catálogo no formato OpenAI function-calling. Cada query vira
 * uma função com schema JSON dos seus parâmetros. O LLM escolhe pelo nome.
 */
export function getCatalogForLLM(): Array<{
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}> {
  return QUERY_CATALOG.map((q) => ({
    name: q.name,
    description: q.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(q.params).map(([k, v]) => [
          k,
          {
            // OpenAI JSON Schema só conhece tipos primitivos — uuid/date viram string.
            type: v.type === 'uuid' || v.type === 'date' ? 'string' : v.type,
            description: v.description,
          },
        ]),
      ),
      required: Object.entries(q.params)
        .filter(([, v]) => v.required)
        .map(([k]) => k),
    },
  }));
}

export function findCatalogEntry(name: string): AiQueryDef | undefined {
  return QUERY_CATALOG.find((q) => q.name === name);
}
