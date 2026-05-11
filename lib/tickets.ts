/**
 * lib/tickets.ts — Helper consolidado para criação de tickets.
 *
 * ## Por que isso existe (Fase 6 — Refactor estrutural)
 *
 * A auditoria identificou 5 callers que duplicavam (com divergências
 * sutis) a lógica de "criar ticket completo" — INSERT em tickets,
 * sincronização de ticket_assignees, embedding semântico, webhooks
 * externos, automações e notificação do assignee:
 *
 *   1. POST /api/tickets                     (canônico, mais completo)
 *   2. POST /api/inbox/[id]/accept           (promove inbox → ticket)
 *   3. POST /api/cron/recurring-tickets      (cron worker, recurring → ticket)
 *   4. POST /api/recurring-tickets/run-now   (admin manual, recurring → ticket)
 *   5. POST /api/webhooks (event=ticket.create) (integração externa n8n/Zapier)
 *
 * Cada cópia tinha gaps diferentes — o cron pulava embedding, o
 * inbox/accept não disparava automações, o webhook não notificava
 * o assignee. Esse helper centraliza TODOS os side-effects e expõe
 * toggles (`skip_*`) para casos onde algum efeito DEVE ser pulado.
 *
 * ## Contrato
 *
 * - INSERT em `tickets` é SÍNCRONO e bloqueia o retorno (caller precisa do id).
 * - Sincronização de `ticket_assignees` é SÍNCRONA dentro do mesmo request.
 * - `audit_log` é SÍNCRONO (mas tem try/catch silencioso interno).
 * - **Fire-and-forget** (NÃO blocking): embedding, webhook externo,
 *   automation, notificação. Falhas são logadas, não propagam.
 *
 * ## Source tracking
 *
 * O campo `source` é gravado no audit_log como contexto pra debug —
 * permite rastrear se um ticket veio de inbox, recurring, webhook etc.
 * Não é persistido na tabela `tickets` (não temos coluna pra isso —
 * deixar pra Fase futura se virar requisito de produto).
 */

import { query } from './db';
import { dispatchWebhook } from './webhooks';
import { runAutomations } from './automations';
import { upsertTicketEmbedding } from './embeddings';
import { logAudit } from './audit';
import { createNotification } from './notifications';

export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';

export type TicketSource =
  | 'manual'      // POST /api/tickets via UI
  | 'inbox'       // promovido de triage_inbox
  | 'recurring'   // gerado por cron de recurring_tickets
  | 'template'    // criado a partir de ticket_template
  | 'rollover'    // movido de sprint anterior (não cria, mas pra futuro)
  | 'webhook';    // POST /api/webhooks event=ticket.create

export interface CreateTicketInput {
  // --- Workspace & escopo ---
  workspace_id: string;
  project_id?: string | null;
  board_id?: string | null;

  // --- Classificação ---
  status_id?: string | null;
  ticket_type_id?: string | null;
  service_id?: string | null;
  category_id?: string | null;
  client_id?: string | null;
  sprint_id?: string | null;

  // --- Conteúdo ---
  title: string;
  description?: string | null;
  priority?: TicketPriority;
  due_date?: string | null;

  // --- Pessoas ---
  /**
   * Assignee primário (legacy `tickets.assignee_id`). Se omitido e
   * `assignee_ids` veio, o primeiro id da lista vira o primário.
   */
  assignee_id?: string | null;
  /**
   * Múltiplos assignees (tabela `ticket_assignees`). Primeiro id da
   * lista vira `is_primary = true`. Se vazio/omitido mas `assignee_id`
   * existir, criamos uma linha primária só com ele.
   */
  assignee_ids?: string[];
  reporter_id?: string | null;

  // --- Hierarquia ---
  parent_id?: string | null;

  // --- Metadata ---
  source?: TicketSource;
}

export interface CreateTicketContext {
  /** Member que iniciou a criação (audit + added_by em ticket_assignees). */
  actor_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;

  // --- Toggles para casos especiais ---
  /** Pula `runAutomations` (ex: cron silencioso). Default: false. */
  skip_automations?: boolean;
  /** Pula `upsertTicketEmbedding` (ex: backfill já fez). Default: false. */
  skip_embedding?: boolean;
  /** Pula webhook externo + notificação in-app. Default: false. */
  skip_notifications?: boolean;
}

export interface CreatedTicket {
  id: string;
  workspace_id: string | null;
  ticket_type_id: string | null;
  status_id: string | null;
  service_id: string | null;
  category_id: string | null;
  assignee_id: string | null;
  reporter_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  sequence_number: number | null;
  project_id: string | null;
  board_id: string | null;
  sprint_id: string | null;
  parent_id: string | null;
  client_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  /** ticket_key derivado da view `tickets_full` (best-effort, pode ser null). */
  ticket_key?: string | null;
}

/**
 * Cria ticket completo (INSERT + assignees + embedding + automations
 * + webhooks + audit + notificação). Substitui as 5 cópias divergentes
 * que existiam antes da Fase 6.
 *
 * Side effects fire-and-forget (embedding, webhook, automation,
 * notificação) NÃO bloqueiam — caller recebe o ticket criado
 * imediatamente após o INSERT + assignees + audit.
 */
export async function createTicket(
  input: CreateTicketInput,
  ctx: CreateTicketContext = {}
): Promise<CreatedTicket> {
  // Auto-atribui sprint ativa do projeto quando ticket é criado sem sprint
  // explícita. Evita tickets "órfãos" (Sprint: Nenhum) que somem dos filtros
  // de Timesheet/Backlog/Reports. Se já veio sprint_id no input, respeita.
  let resolvedSprintId = input.sprint_id ?? null;
  if (!resolvedSprintId && input.project_id) {
    try {
      const activeSprint = await query<{ id: string }>(
        `SELECT id FROM sprints
         WHERE project_id = $1 AND is_active = true AND is_completed = false
         ORDER BY created_at DESC LIMIT 1`,
        [input.project_id]
      );
      if (activeSprint.rows[0]) {
        resolvedSprintId = activeSprint.rows[0].id;
      }
    } catch {
      // sprints sem coluna is_active (migration antiga) — ignora silenciosamente
    }
  }

  // 1. INSERT em tickets — síncrono, caller precisa do id de volta
  const insertRes = await query<CreatedTicket>(
    `INSERT INTO tickets (
       workspace_id,
       ticket_type_id,
       status_id,
       service_id,
       category_id,
       assignee_id,
       reporter_id,
       title,
       description,
       priority,
       due_date,
       parent_id,
       sprint_id,
       client_id,
       project_id,
       board_id,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       NOW(), NOW()
     ) RETURNING *`,
    [
      input.workspace_id,
      input.ticket_type_id ?? null,
      input.status_id ?? null,
      input.service_id ?? null,
      input.category_id ?? null,
      input.assignee_id ?? null,
      input.reporter_id ?? null,
      input.title,
      input.description ?? null,
      input.priority ?? 'medium',
      input.due_date ?? null,
      input.parent_id ?? null,
      resolvedSprintId,
      input.client_id ?? null,
      input.project_id ?? null,
      input.board_id ?? null,
    ]
  );

  const ticket = insertRes.rows[0];
  if (!ticket) {
    throw new Error('createTicket: INSERT não retornou linha — falha silenciosa do driver?');
  }

  // 2. Sincronizar ticket_assignees (multi-assignee, fase 4).
  // Convenção: se `assignee_ids[]` veio, o primeiro vira primary.
  // Se a coluna `tickets.assignee_id` divergir do primary, atualizamos
  // pra manter consistência com queries antigas que ainda usam a coluna.
  await syncAssignees(ticket, input.assignee_ids, ctx.actor_id);

  // 3. Audit log SEMPRE (mesmo com skip flags) — auditoria é compliance,
  // não notificação. Source vai como contexto pra debug.
  logAudit({
    workspaceId: ticket.workspace_id,
    actorId: ctx.actor_id ?? null,
    action: 'ticket.created',
    entityType: 'ticket',
    entityId: ticket.id,
    changes: {
      title: ticket.title,
      priority: ticket.priority,
      assignee_id: ticket.assignee_id,
      project_id: ticket.project_id,
      board_id: ticket.board_id,
      source: input.source ?? 'manual',
    },
    ipAddress: ctx.ip_address ?? null,
    userAgent: ctx.user_agent ?? null,
  }).catch((err) => {
    // logAudit já tem try/catch interno; este catch é defesa-em-profundidade.
    console.error('[createTicket] audit failed:', err);
  });

  // 4. Embedding semântico (fire-and-forget). Pula se backfill ou
  // ambiente sem OPENAI_API_KEY (a função interna já checa).
  if (!ctx.skip_embedding) {
    upsertTicketEmbedding(ticket.id, ticket.title, ticket.description).catch((err) => {
      console.error('[createTicket] embedding failed for', ticket.id, err);
    });
  }

  // 5. Webhook externo (fire-and-forget). dispatchWebhook já é async-safe.
  if (!ctx.skip_notifications) {
    dispatchWebhook('ticket.created', {
      ...ticket,
      source: input.source ?? 'manual',
    });
  }

  // 6. Automations (fire-and-forget). runAutomations tem try/catch interno.
  if (!ctx.skip_automations) {
    runAutomations({
      ticket,
      event: 'ticket.created',
      workspace_id: ticket.workspace_id ?? input.workspace_id,
      actor_id: ctx.actor_id ?? undefined,
    }).catch((err) => {
      console.error('[createTicket] automations failed:', err);
    });
  }

  // 7. Notificar assignee primário se diferente do actor (fire-and-forget).
  if (
    !ctx.skip_notifications &&
    ticket.assignee_id &&
    ticket.assignee_id !== ctx.actor_id
  ) {
    notifyAssigneeOnCreate(ticket).catch((err) => {
      console.error('[createTicket] assignee notification failed:', err);
    });
  }

  // 8. Best-effort: anexar ticket_key da view tickets_full pro caller
  // (alguns endpoints retornam isso na response). Síncrono pra garantir
  // shape consistente, mas erra silenciosamente — view pode não existir
  // em alguns ambientes de teste.
  try {
    const keyRes = await query<{ ticket_key: string | null }>(
      `SELECT ticket_key FROM tickets_full WHERE id = $1`,
      [ticket.id]
    );
    ticket.ticket_key = keyRes.rows[0]?.ticket_key ?? null;
  } catch {
    ticket.ticket_key = null;
  }

  return ticket;
}

/**
 * Sincroniza ticket_assignees a partir de assignee_ids[].
 *
 * Regras:
 *  - Se `assignee_ids` veio com itens, primeiro id vira primary.
 *    Se primary diferente de `tickets.assignee_id`, ajusta a coluna.
 *  - Se `assignee_ids` vazio MAS `ticket.assignee_id` existe, cria
 *    linha primária só com ele (mantém a tabela consistente desde o
 *    create — antes era responsabilidade dos endpoints individuais).
 *  - Se nada veio, no-op.
 *
 * Erros são logados, não propagados — assignee é metadata, não pode
 * derrubar a criação do ticket. Comportamento idêntico ao caller original.
 */
async function syncAssignees(
  ticket: CreatedTicket,
  assigneeIds: string[] | undefined,
  actorId: string | null | undefined
): Promise<void> {
  try {
    const ids = assigneeIds?.filter((v): v is string => typeof v === 'string' && v.length > 0);

    if (ids && ids.length > 0) {
      const primaryId = ids[0];
      // Se primary diverge da coluna principal, sincroniza
      if (ticket.assignee_id !== primaryId) {
        await query(
          `UPDATE tickets SET assignee_id = $1 WHERE id = $2`,
          [primaryId, ticket.id]
        );
        ticket.assignee_id = primaryId;
      }
      for (let i = 0; i < ids.length; i++) {
        await query(
          `INSERT INTO ticket_assignees (ticket_id, member_id, is_primary, added_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (ticket_id, member_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
          [ticket.id, ids[i], i === 0, actorId ?? null]
        );
      }
    } else if (ticket.assignee_id) {
      await query(
        `INSERT INTO ticket_assignees (ticket_id, member_id, is_primary, added_by)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (ticket_id, member_id) DO NOTHING`,
        [ticket.id, ticket.assignee_id, actorId ?? null]
      );
    }
  } catch (err) {
    console.error('[createTicket] sync ticket_assignees failed:', err);
  }
}

/**
 * Notifica o assignee primário sobre nova atribuição.
 * Async pra poder buscar ticket_key da view, mas chamado fire-and-forget.
 */
async function notifyAssigneeOnCreate(ticket: CreatedTicket): Promise<void> {
  if (!ticket.assignee_id || !ticket.workspace_id) return;

  let ticketKey = ticket.ticket_key ?? '';
  if (!ticketKey) {
    try {
      const keyRes = await query<{ ticket_key: string }>(
        `SELECT ticket_key FROM tickets_full WHERE id = $1`,
        [ticket.id]
      );
      ticketKey = keyRes.rows[0]?.ticket_key || '';
    } catch {
      ticketKey = '';
    }
  }

  await createNotification({
    workspace_id: ticket.workspace_id,
    recipient_id: ticket.assignee_id,
    actor_id: ticket.reporter_id || undefined,
    type: 'assigned',
    entity_type: 'ticket',
    entity_id: ticket.id,
    title: `Você foi atribuído ao ticket${ticketKey ? ` ${ticketKey}` : ''}`,
    message: ticket.title,
    link: `/ticket/${ticket.id}`,
  });
}
