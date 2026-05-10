import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { query } from '@/lib/db';
import { computeNextRunAt, renderTitleTemplate } from '@/lib/recurring';
import { safeEqual } from '@/lib/crypto-utils';
import { createTicket, type TicketPriority } from '@/lib/tickets';

/**
 * Sentry Cron monitoring (Fase 7.3) — ver comentário equivalente em
 * /api/cron/sla-check/route.ts. No-op gracioso quando DSN não definido.
 */
const MONITOR_SLUG = 'cron-recurring-tickets';
const MONITOR_CONFIG = {
  schedule: { type: 'crontab', value: '*/15 * * * *' },
  checkinMargin: 5,
  maxRuntime: 10,
  timezone: 'UTC',
} as const;

/**
 * Cron worker — chamado externamente (Vercel Cron, cron-job.org, etc.)
 *
 * Auth: header `x-cron-secret` deve bater com env CRON_SECRET. Se CRON_SECRET
 * não estiver setado, o endpoint exige ao menos `Authorization: Bearer <token>`
 * onde token == NEXT_PUBLIC_APP_URL fallback. (Em prod sempre defina CRON_SECRET.)
 *
 * Para cada recurring ativo com next_run_at <= NOW():
 *  1. cria o ticket no board correspondente
 *  2. cria subtasks (se houver — não usado nesse modelo, deixado para future)
 *  3. recalcula next_run_at usando cron-parser
 *  4. atualiza last_run_at = NOW()
 *
 * Ticket criado herda: title (renderizado), description_html, ticket_type_id,
 * service_id, assignee_id, priority, project_id, board_id.
 */

interface RecurringRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  board_id: string | null;
  title_template: string;
  description_html: string | null;
  ticket_type_id: string | null;
  service_id: string | null;
  assignee_id: string | null;
  priority: string | null;
  cron_expression: string;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Em dev, permite chamadas locais sem secret. Em prod isso é loud-fail.
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }
  const headerSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;
  return safeEqual(headerSecret, secret);
}

async function resolveDefaultStatusId(workspaceId: string): Promise<string | null> {
  // Statuses são workspace-scoped (não board-scoped). Pega o de menor position
  // como "coluna inicial" — segue a convenção do board.
  try {
    const r = await query<{ id: string }>(
      `SELECT id FROM statuses
       WHERE workspace_id = $1
       ORDER BY position ASC NULLS LAST
       LIMIT 1`,
      [workspaceId]
    );
    return r.rows[0]?.id || null;
  } catch {
    return null;
  }
}

async function runRecurringTickets(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  const created: { recurring_id: string; ticket_id: string }[] = [];
  const errors: { recurring_id: string; error: string }[] = [];

  try {
    const due = await query<RecurringRow>(
      `SELECT id, workspace_id, project_id, board_id, title_template,
              description_html, ticket_type_id, service_id, assignee_id,
              priority, cron_expression
       FROM recurring_tickets
       WHERE is_active = true
         AND next_run_at IS NOT NULL
         AND next_run_at <= NOW()
       ORDER BY next_run_at ASC
       LIMIT 100`
    );

    for (const r of due.rows) {
      try {
        const title = renderTitleTemplate(r.title_template, startedAt);
        const statusId = await resolveDefaultStatusId(r.workspace_id);

        // Cria ticket via helper consolidado (lib/tickets, Fase 6).
        // ATIVA notificações + automations + embedding por padrão: usuário
        // que configurou recurring espera o ciclo completo (assignee notificado,
        // automations rodadas, ticket indexado pra similaridade). Antes essa
        // versão pulava tudo silenciosamente — gap corrigido.
        // skip_automations poderia ser ativado se observarmos loop entre cron
        // e regras de automation no futuro.
        const inserted = await createTicket(
          {
            workspace_id: r.workspace_id,
            project_id: r.project_id,
            board_id: r.board_id,
            status_id: statusId,
            ticket_type_id: r.ticket_type_id,
            service_id: r.service_id,
            title,
            description: r.description_html || '',
            priority: (r.priority || 'medium') as TicketPriority,
            assignee_id: r.assignee_id,
            reporter_id: r.assignee_id, // reporter = assignee (recurring é "system-generated")
            source: 'recurring',
          },
          {
            actor_id: null, // cron não tem actor humano
          }
        );

        const newNextRun = computeNextRunAt(r.cron_expression, new Date());
        await query(
          `UPDATE recurring_tickets
           SET last_run_at = NOW(), next_run_at = $1
           WHERE id = $2`,
          [newNextRun, r.id]
        );

        created.push({ recurring_id: r.id, ticket_id: inserted.id });
      } catch (err) {
        const msg = (err as Error).message || 'erro desconhecido';
        console.error(`[cron/recurring] falha ao processar ${r.id}:`, msg);
        errors.push({ recurring_id: r.id, error: msg });
        // Avança o next_run_at mesmo com erro pra não ficar em loop quente.
        try {
          const newNextRun = computeNextRunAt(r.cron_expression, new Date());
          await query(
            `UPDATE recurring_tickets SET next_run_at = $1 WHERE id = $2`,
            [newNextRun, r.id]
          );
        } catch {
          /* swallow — retentaremos no próximo tick */
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processed: due.rows.length,
      created: created.length,
      errors: errors.length,
      details: { created, errors },
      ran_at: startedAt.toISOString(),
    });
  } catch (err) {
    console.error('POST /api/cron/recurring-tickets error:', err);
    return NextResponse.json(
      { error: 'Erro interno', message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return Sentry.withMonitor(
    MONITOR_SLUG,
    () => runRecurringTickets(request),
    MONITOR_CONFIG,
  );
}

// Permite GET pra healthcheck via Vercel Cron (que usa GET por padrão).
export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}
