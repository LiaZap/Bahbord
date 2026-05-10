import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

/**
 * GET /api/notifications
 * Lista APENAS as notificações cujo recipient é o usuário autenticado.
 * Query params:
 *   ?unread_only=true - retorna só não-lidas
 *   ?limit=N (default 30, max 100)
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json([], { status: 200 });

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    const result = await query(
      `SELECT n.id, n.type, n.title, n.message, n.link, n.is_read, n.created_at,
        n.ticket_id, n.entity_type,
        m.display_name AS actor_name,
        tf.ticket_key
      FROM notifications n
      LEFT JOIN members m ON m.id = COALESCE(n.actor_id, n.member_id)
      LEFT JOIN tickets_full tf ON tf.id = n.ticket_id
      WHERE COALESCE(n.recipient_id, n.member_id) = $1
        ${unreadOnly ? 'AND n.is_read = false' : ''}
      ORDER BY n.created_at DESC
      LIMIT $2`,
      [auth.id, limit]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Marca notificação(s) como lida(s) — APENAS as do usuário autenticado.
 * Suporta:
 *   ?id=X - marca uma específica
 *   sem id e sem body - marca TODAS as do user como lidas
 *   body { action: 'read_all' } - mesma coisa (compat legado)
 *   body { id: X } - marca uma específica (compat legado)
 */
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    let bodyId: string | undefined;
    let action: string | undefined;
    try {
      const body = await request.json();
      bodyId = body?.id;
      action = body?.action;
    } catch {
      // sem body = mark all read
    }

    const targetId = queryId || bodyId;

    if (targetId) {
      await query(
        `UPDATE notifications SET is_read = true
         WHERE id = $1 AND COALESCE(recipient_id, member_id) = $2`,
        [targetId, auth.id]
      );
      return NextResponse.json({ ok: true });
    }

    // Sem id ou action=read_all → marca todas do user
    await query(
      `UPDATE notifications SET is_read = true
       WHERE is_read = false AND COALESCE(recipient_id, member_id) = $1`,
      [auth.id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/notifications error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
