import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';

/**
 * POST /api/inbox/[id]/duplicate
 * body: { duplicate_of_ticket_id: string }
 *
 * Marca inbox item como duplicate. Não cria ticket. Salva ref ao ticket
 * original em duplicate_of_ticket_id.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const inboxId = params.id;
    let body: { duplicate_of_ticket_id?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const dupTicketId = body.duplicate_of_ticket_id;
    if (!dupTicketId) {
      return NextResponse.json(
        { error: 'duplicate_of_ticket_id obrigatório' },
        { status: 400 }
      );
    }

    const itemRes = await query<{ id: string; workspace_id: string; status: string }>(
      `SELECT id, workspace_id, status FROM triage_inbox WHERE id = $1`,
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

    // Confirma que ticket existe + usuário tem acesso
    const ticketRes = await query<{ id: string; workspace_id: string }>(
      `SELECT id, workspace_id FROM tickets WHERE id = $1`,
      [dupTicketId]
    );
    if (!ticketRes.rows[0]) {
      return NextResponse.json({ error: 'Ticket original não encontrado' }, { status: 404 });
    }
    if (ticketRes.rows[0].workspace_id !== auth.workspace_id) {
      return NextResponse.json(
        { error: 'Ticket original em outro workspace' },
        { status: 403 }
      );
    }
    const access = await hasTicketAccess(auth, dupTicketId);
    if (!access) {
      return NextResponse.json(
        { error: 'Sem acesso ao ticket original' },
        { status: 403 }
      );
    }

    await query(
      `UPDATE triage_inbox
       SET status = 'duplicate',
           duplicate_of_ticket_id = $1,
           triaged_at = NOW(),
           triaged_by = $2
       WHERE id = $3`,
      [dupTicketId, auth.id, inboxId]
    );

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'triage.marked_duplicate',
      entityType: 'triage_inbox',
      entityId: inboxId,
      changes: { duplicate_of: dupTicketId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, inbox_id: inboxId, duplicate_of: dupTicketId });
  } catch (err) {
    console.error('POST /api/inbox/[id]/duplicate error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
