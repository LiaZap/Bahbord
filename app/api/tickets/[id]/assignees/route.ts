import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { notifyMember } from '@/lib/notifications';

/**
 * GET /api/tickets/[id]/assignees
 * Lista assignees (member_id, display_name, avatar_url, is_primary, added_at).
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const access = await hasTicketAccess(auth, params.id);
    if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const result = await query(
      `SELECT
        ta.member_id,
        m.display_name,
        m.email,
        m.avatar_url,
        ta.is_primary,
        ta.added_at,
        ta.added_by
      FROM ticket_assignees ta
      JOIN members m ON m.id = ta.member_id
      WHERE ta.ticket_id = $1
      ORDER BY ta.is_primary DESC, ta.added_at ASC`,
      [params.id]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/tickets/[id]/assignees error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST /api/tickets/[id]/assignees
 * body: { member_id, is_primary? }
 *
 * Adiciona assignee. Se is_primary=true, promove esse e desmarca os outros,
 * e atualiza tickets.assignee_id pra manter compatibilidade.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const access = await hasTicketAccess(auth, params.id);
    if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    let body: { member_id?: string; is_primary?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const memberId = body.member_id;
    const isPrimary = body.is_primary === true;
    if (!memberId) {
      return NextResponse.json({ error: 'member_id obrigatório' }, { status: 400 });
    }

    // Confere se member existe e está no mesmo workspace do ticket
    const ticketRes = await query<{ workspace_id: string; assignee_id: string | null; title: string; ticket_key: string }>(
      `SELECT workspace_id, assignee_id, title, ticket_key FROM tickets_full WHERE id = $1`,
      [params.id]
    );
    if (!ticketRes.rows[0]) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }
    const { workspace_id: wsId, assignee_id: previousPrimary, title: ticketTitle, ticket_key: ticketKey } = ticketRes.rows[0];

    // Detecta se já era assignee (pra não notificar em toggle de primary)
    const existingRes = await query(
      `SELECT 1 FROM ticket_assignees WHERE ticket_id = $1 AND member_id = $2`,
      [params.id, memberId]
    );
    const wasAlreadyAssignee = existingRes.rowCount! > 0;

    const memberRes = await query(
      `SELECT id FROM members WHERE id = $1 AND workspace_id = $2`,
      [memberId, wsId]
    );
    if (!memberRes.rows[0]) {
      return NextResponse.json({ error: 'Membro inválido para este workspace' }, { status: 400 });
    }

    // Insere (ou atualiza is_primary se já existia). Se is_primary=true,
    // desmarca os demais antes pra garantir só um primary.
    if (isPrimary) {
      await query(
        `UPDATE ticket_assignees SET is_primary = false WHERE ticket_id = $1`,
        [params.id]
      );
    }

    const upserted = await query(
      `INSERT INTO ticket_assignees (ticket_id, member_id, is_primary, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ticket_id, member_id)
       DO UPDATE SET is_primary = EXCLUDED.is_primary
       RETURNING ticket_id, member_id, is_primary, added_at`,
      [params.id, memberId, isPrimary, auth.id]
    );

    // Sincroniza tickets.assignee_id quando primário mudou
    if (isPrimary) {
      await query(
        `UPDATE tickets SET assignee_id = $1, updated_at = NOW() WHERE id = $2`,
        [memberId, params.id]
      );
    } else if (!previousPrimary) {
      // Se ticket não tinha primary algum, promove esse novo automaticamente
      await query(
        `UPDATE ticket_assignees SET is_primary = true WHERE ticket_id = $1 AND member_id = $2`,
        [params.id, memberId]
      );
      await query(
        `UPDATE tickets SET assignee_id = $1, updated_at = NOW() WHERE id = $2`,
        [memberId, params.id]
      );
    }

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: wsId,
      actorId: auth.id,
      action: 'ticket.assignee_added',
      entityType: 'ticket',
      entityId: params.id,
      changes: { member_id: memberId, is_primary: isPrimary },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Notifica novo assignee (skip self e skip toggle de primary)
    if (!wasAlreadyAssignee && memberId !== auth.id) {
      notifyMember(memberId, 'ticket.assigned', {
        title: `Você foi atribuído a ${ticketKey}`,
        message: ticketTitle,
        ticketId: params.id,
      });
    }

    return NextResponse.json(upserted.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/tickets/[id]/assignees error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/tickets/[id]/assignees?member_id=X
 *
 * Remove assignee. Se for o primário, promove qualquer outro restante a
 * primary (e atualiza tickets.assignee_id). Se não houver mais nenhum,
 * limpa tickets.assignee_id.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const access = await hasTicketAccess(auth, params.id);
    if (!access) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    if (!memberId) {
      return NextResponse.json({ error: 'member_id obrigatório' }, { status: 400 });
    }

    const ticketRes = await query<{ workspace_id: string; assignee_id: string | null }>(
      `SELECT workspace_id, assignee_id FROM tickets WHERE id = $1`,
      [params.id]
    );
    if (!ticketRes.rows[0]) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }
    const { workspace_id: wsId, assignee_id: previousPrimary } = ticketRes.rows[0];

    const removed = await query(
      `DELETE FROM ticket_assignees
       WHERE ticket_id = $1 AND member_id = $2
       RETURNING is_primary`,
      [params.id, memberId]
    );
    if (removed.rowCount === 0) {
      return NextResponse.json({ error: 'Assignee não encontrado' }, { status: 404 });
    }

    const wasPrimary = removed.rows[0]?.is_primary === true || previousPrimary === memberId;

    if (wasPrimary) {
      // Promove qualquer um restante (mais antigo primeiro pra estabilidade)
      const next = await query<{ member_id: string }>(
        `SELECT member_id FROM ticket_assignees
         WHERE ticket_id = $1
         ORDER BY added_at ASC
         LIMIT 1`,
        [params.id]
      );
      if (next.rows[0]) {
        await query(
          `UPDATE ticket_assignees SET is_primary = true
           WHERE ticket_id = $1 AND member_id = $2`,
          [params.id, next.rows[0].member_id]
        );
        await query(
          `UPDATE tickets SET assignee_id = $1, updated_at = NOW() WHERE id = $2`,
          [next.rows[0].member_id, params.id]
        );
      } else {
        await query(
          `UPDATE tickets SET assignee_id = NULL, updated_at = NOW() WHERE id = $1`,
          [params.id]
        );
      }
    }

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: wsId,
      actorId: auth.id,
      action: 'ticket.assignee_removed',
      entityType: 'ticket',
      entityId: params.id,
      changes: { member_id: memberId, was_primary: wasPrimary },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tickets/[id]/assignees error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
