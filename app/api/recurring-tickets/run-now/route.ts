import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { renderTitleTemplate } from '@/lib/recurring';
import { extractRequestMeta } from '@/lib/audit';
import { createTicket, type TicketPriority } from '@/lib/tickets';

/**
 * POST /api/recurring-tickets/run-now
 * Body: { id: string }
 * Admin-only. Executa um recurring específico AGORA, criando o ticket.
 * NÃO altera last_run_at/next_run_at (é só pra teste/manual).
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const r = await query<{
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
    }>(
      `SELECT id, workspace_id, project_id, board_id, title_template,
              description_html, ticket_type_id, service_id, assignee_id, priority
       FROM recurring_tickets
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (r.rowCount === 0) {
      return NextResponse.json({ error: 'Recurring não encontrado ou inativo' }, { status: 404 });
    }

    const row = r.rows[0];
    const now = new Date();
    const title = renderTitleTemplate(row.title_template, now);

    // Status default (primeira coluna)
    const statusRes = await query<{ id: string }>(
      `SELECT id FROM statuses WHERE workspace_id = $1 ORDER BY position ASC NULLS LAST LIMIT 1`,
      [row.workspace_id]
    );
    const statusId = statusRes.rows[0]?.id || null;

    const meta = extractRequestMeta(request);

    // Cria ticket via helper consolidado (lib/tickets, Fase 6).
    // Run-now é manual/admin → ATIVA tudo (igual ao POST normal). actor_id
    // é o admin que clicou, não o assignee — reporter cai no assignee
    // (system-generated, mesma convenção do cron).
    const inserted = await createTicket(
      {
        workspace_id: row.workspace_id,
        project_id: row.project_id,
        board_id: row.board_id,
        status_id: statusId,
        ticket_type_id: row.ticket_type_id,
        service_id: row.service_id,
        title,
        description: row.description_html || '',
        priority: (row.priority || 'medium') as TicketPriority,
        assignee_id: row.assignee_id,
        reporter_id: row.assignee_id || auth.id,
        source: 'recurring',
      },
      {
        actor_id: auth.id,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      }
    );

    // Info adicional pra mostrar onde criou (UI mostra projeto + board)
    const info_ = await query<{ project_name: string | null; board_name: string | null }>(
      `SELECT p.name AS project_name, b.name AS board_name
       FROM tickets t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN boards b ON b.id = t.board_id
       WHERE t.id = $1`,
      [inserted.id]
    );
    const info = info_.rows[0] || {};

    return NextResponse.json({
      ok: true,
      ticket_id: inserted.id,
      title,
      project_name: info.project_name,
      board_name: info.board_name,
      ticket_key: inserted.ticket_key,
    });
  } catch (err) {
    console.error('POST /api/recurring-tickets/run-now error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
