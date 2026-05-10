import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { dispatchWebhook } from '@/lib/webhooks';

interface AcceptBody {
  project_id?: string;
  board_id?: string;
  status_id?: string;
  type_id?: string;
  ticket_type_id?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  assignee_id?: string;
  title?: string;
  description?: string;
}

const VALID_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

/**
 * POST /api/inbox/[id]/accept
 *
 * Promove inbox item -> ticket real. Override de campos da sugestão IA é
 * permitido via body. Marca inbox como accepted + resulting_ticket_id.
 *
 * Permissão: admin OU membro com acesso ao project_id destino.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const inboxId = params.id;
    let body: AcceptBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    // Carrega item + valida workspace e status
    const itemRes = await query<{
      id: string;
      workspace_id: string;
      status: string;
      title: string;
      description: string | null;
      ai_suggestion: { priority?: string; assignee_id?: string } | null;
      reporter_email: string | null;
    }>(
      `SELECT id, workspace_id, status, title, description, ai_suggestion, reporter_email
       FROM triage_inbox WHERE id = $1`,
      [inboxId]
    );
    if (!itemRes.rows[0]) {
      return NextResponse.json({ error: 'Inbox item não encontrado' }, { status: 404 });
    }
    const item = itemRes.rows[0];

    if (item.workspace_id !== auth.workspace_id) {
      return NextResponse.json({ error: 'Item de outro workspace' }, { status: 403 });
    }
    if (item.status !== 'pending') {
      return NextResponse.json(
        { error: `Item já está em status "${item.status}"` },
        { status: 409 }
      );
    }

    // Resolve project_id (override > existente). Sugestão IA pode trazer projeto
    // mas não confiamos nela sem confirmação humana — body é a fonte de verdade.
    const projectId = body.project_id;
    if (!projectId) {
      return NextResponse.json({ error: 'project_id obrigatório' }, { status: 400 });
    }

    // Permissão: admin OU acesso ao projeto
    if (!isAdmin(auth.role)) {
      const access = await hasProjectAccess(auth, projectId);
      if (!access) {
        return NextResponse.json(
          { error: 'Sem permissão para criar ticket neste projeto' },
          { status: 403 }
        );
      }
    }

    // Resolve board_id — se não enviado, pega default do projeto
    let boardId = body.board_id || null;
    if (!boardId) {
      const boardRes = await query<{ id: string }>(
        `SELECT id FROM boards WHERE project_id = $1
         ORDER BY is_default DESC NULLS LAST, created_at ASC LIMIT 1`,
        [projectId]
      );
      boardId = boardRes.rows[0]?.id || null;
    }

    // Resolve status — default = primeiro status (position ASC)
    let statusId = body.status_id || null;
    if (!statusId) {
      const statusRes = await query<{ id: string }>(
        `SELECT id FROM statuses ORDER BY position ASC LIMIT 1`
      );
      statusId = statusRes.rows[0]?.id || null;
    }

    // Type — body.type_id ou body.ticket_type_id, ou default do workspace
    let ticketTypeId = body.ticket_type_id || body.type_id || null;
    if (!ticketTypeId) {
      const typeRes = await query<{ id: string }>(
        `SELECT id FROM ticket_types ORDER BY position ASC NULLS LAST LIMIT 1`
      );
      ticketTypeId = typeRes.rows[0]?.id || null;
    }

    // Priority: body > ai_suggestion > 'medium'
    let priority: string = body.priority || item.ai_suggestion?.priority || 'medium';
    if (!VALID_PRIORITIES.includes(priority as typeof VALID_PRIORITIES[number])) {
      priority = 'medium';
    }

    // Assignee: body > ai_suggestion (se válido) > NULL
    const assigneeId = body.assignee_id || item.ai_suggestion?.assignee_id || null;

    const finalTitle = (body.title?.trim()) || item.title;
    const finalDescription = body.description ?? item.description;

    // Cria ticket
    const ticketRes = await query<{ id: string; sequence_number: number }>(
      `INSERT INTO tickets (
         workspace_id, ticket_type_id, status_id, assignee_id, reporter_id,
         title, description, priority, project_id, board_id,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
       ) RETURNING id, sequence_number`,
      [
        auth.workspace_id,
        ticketTypeId,
        statusId,
        assigneeId,
        auth.id, // reporter = quem aceitou (não temos member do externo)
        finalTitle,
        finalDescription,
        priority,
        projectId,
        boardId,
      ]
    );
    const newTicket = ticketRes.rows[0];

    // Marca inbox como accepted
    await query(
      `UPDATE triage_inbox
       SET status = 'accepted',
           resulting_ticket_id = $1,
           triaged_at = NOW(),
           triaged_by = $2
       WHERE id = $3`,
      [newTicket.id, auth.id, inboxId]
    );

    // Webhook + audit
    dispatchWebhook('ticket.created', {
      id: newTicket.id,
      title: finalTitle,
      priority,
      from_inbox: true,
    });

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'triage.accepted',
      entityType: 'triage_inbox',
      entityId: inboxId,
      changes: {
        ticket_id: newTicket.id,
        project_id: projectId,
        board_id: boardId,
        priority,
        assignee_id: assigneeId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(
      {
        ok: true,
        inbox_id: inboxId,
        ticket: { id: newTicket.id, sequence_number: newTicket.sequence_number },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/inbox/[id]/accept error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
