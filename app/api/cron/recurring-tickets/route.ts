import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { computeNextRunAt, renderTitleTemplate } from '@/lib/recurring';
import { safeEqual } from '@/lib/crypto-utils';

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

export async function POST(request: Request) {
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

        const inserted = await query<{ id: string }>(
          `INSERT INTO tickets (
            workspace_id, ticket_type_id, status_id, service_id,
            assignee_id, reporter_id, title, description, priority,
            project_id, board_id, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
          ) RETURNING id`,
          [
            r.workspace_id,
            r.ticket_type_id,
            statusId,
            r.service_id,
            r.assignee_id,
            r.assignee_id, // reporter = assignee (recurring é "system-generated")
            title,
            r.description_html || '',
            r.priority || 'medium',
            r.project_id,
            r.board_id,
          ]
        );

        const newNextRun = computeNextRunAt(r.cron_expression, new Date());
        await query(
          `UPDATE recurring_tickets
           SET last_run_at = NOW(), next_run_at = $1
           WHERE id = $2`,
          [newNextRun, r.id]
        );

        created.push({ recurring_id: r.id, ticket_id: inserted.rows[0].id });
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

// Permite GET pra healthcheck via Vercel Cron (que usa GET por padrão).
export async function GET(request: Request) {
  return POST(request);
}
