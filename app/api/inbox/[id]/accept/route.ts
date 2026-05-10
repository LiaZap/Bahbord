import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { createTicket, type TicketPriority } from '@/lib/tickets';

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

    const meta = extractRequestMeta(request);

    // Cria ticket via helper consolidado (lib/tickets, Fase 6).
    // Antes: INSERT inline + dispatchWebhook só, sem embedding/automation/notificação.
    // Agora: ganha embedding semântico, automations e notificação do assignee
    // automaticamente — comportamento alinhado com POST /api/tickets.
    const newTicket = await createTicket(
      {
        workspace_id: auth.workspace_id,
        project_id: projectId,
        board_id: boardId,
        status_id: statusId,
        ticket_type_id: ticketTypeId,
        title: finalTitle,
        description: finalDescription,
        priority: priority as TicketPriority,
        assignee_id: assigneeId,
        reporter_id: auth.id, // reporter = quem aceitou (não temos member do externo)
        source: 'inbox',
      },
      {
        actor_id: auth.id,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      }
    );

    // Post-processing específico do inbox: marca item como accepted.
    // FICA APÓS createTicket pra garantir que só atualizamos o inbox se o
    // ticket realmente foi criado (createTicket lança em caso de falha).
    await query(
      `UPDATE triage_inbox
       SET status = 'accepted',
           resulting_ticket_id = $1,
           triaged_at = NOW(),
           triaged_by = $2
       WHERE id = $3`,
      [newTicket.id, auth.id, inboxId]
    );

    // Audit específico do FLUXO de triagem (separado do audit ticket.created
    // que createTicket já registrou). Mantém rastreabilidade do "promovido
    // de inbox X" no audit_log.
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
