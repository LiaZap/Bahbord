import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';

interface SnoozeBody {
  snoozed_until?: string | null;
}

/**
 * POST/PATCH /api/tickets/[id]/snooze
 * body: { snoozed_until: ISO string | null }
 *
 * Permissão: assignee do ticket OU admin/owner.
 * Passar null limpa o snooze.
 */
async function handleSnooze(request: Request, ticketId: string) {
  const auth = await getAuthMember();
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // Buscar ticket pra checar assignee + workspace_id (pra audit log)
  const ticketRes = await query<{
    id: string;
    workspace_id: string;
    assignee_id: string | null;
    snoozed_until: string | null;
  }>(
    `SELECT id, workspace_id, assignee_id, snoozed_until FROM tickets WHERE id = $1`,
    [ticketId]
  );
  if (!ticketRes.rows[0]) {
    return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
  }
  const ticket = ticketRes.rows[0];

  // Permissão: assignee primário OU assignee adicional OU admin
  const isOwner = isAdmin(auth.role);
  let canSnooze = isOwner || ticket.assignee_id === auth.id;
  if (!canSnooze) {
    const extraAssignee = await query(
      `SELECT 1 FROM ticket_assignees WHERE ticket_id = $1 AND member_id = $2 LIMIT 1`,
      [ticketId, auth.id]
    );
    canSnooze = (extraAssignee.rowCount ?? 0) > 0;
  }
  if (!canSnooze) {
    // Cair pra hasTicketAccess se for admin de board/projeto
    const access = await hasTicketAccess(auth, ticketId);
    if (!access) {
      return NextResponse.json(
        { error: 'Apenas assignees ou admins podem snoozar este ticket' },
        { status: 403 }
      );
    }
  }

  let body: SnoozeBody;
  try {
    body = (await request.json()) as SnoozeBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const raw = body.snoozed_until;
  let snoozedUntil: Date | null = null;
  if (raw !== null && raw !== undefined && raw !== '') {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'snoozed_until inválido (use ISO 8601)' }, { status: 400 });
    }
    // Snooze no passado não faz sentido — rejeita
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'snoozed_until precisa estar no futuro' },
        { status: 400 }
      );
    }
    snoozedUntil = parsed;
  }

  const result = await query(
    `UPDATE tickets
     SET snoozed_until = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, snoozed_until`,
    [snoozedUntil, ticketId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
  }

  const meta = extractRequestMeta(request);
  logAudit({
    workspaceId: ticket.workspace_id,
    actorId: auth.id,
    action: snoozedUntil ? 'ticket.snoozed' : 'ticket.unsnoozed',
    entityType: 'ticket',
    entityId: ticketId,
    changes: {
      snoozed_until: { from: ticket.snoozed_until, to: snoozedUntil?.toISOString() ?? null },
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json(result.rows[0]);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    return await handleSnooze(request, params.id);
  } catch (err) {
    console.error('POST /api/tickets/[id]/snooze error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    return await handleSnooze(request, params.id);
  } catch (err) {
    console.error('PATCH /api/tickets/[id]/snooze error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
