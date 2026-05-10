import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

/**
 * POST /api/inbox/[id]/reject
 * body: { reason?: string }
 *
 * Rejeita inbox item (não vira ticket, não é duplicate). Reason opcional
 * pra audit trail.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const inboxId = params.id;
    let body: { reason?: string } = {};
    try {
      body = await request.json();
    } catch {
      // body vazio é ok
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

    const reason = body.reason ? String(body.reason).slice(0, 500) : null;

    await query(
      `UPDATE triage_inbox
       SET status = 'rejected',
           reject_reason = $1,
           triaged_at = NOW(),
           triaged_by = $2
       WHERE id = $3`,
      [reason, auth.id, inboxId]
    );

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'triage.rejected',
      entityType: 'triage_inbox',
      entityId: inboxId,
      changes: { reason },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, inbox_id: inboxId });
  } catch (err) {
    console.error('POST /api/inbox/[id]/reject error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
