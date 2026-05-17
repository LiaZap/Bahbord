import { NextResponse } from 'next/server';
import { getAuthMember } from '@/lib/api-auth';
import { db } from '@/lib/drizzle';
import { notifications } from '@/lib/schema/social';
import { members } from '@/lib/schema/core';
import { eq, and, desc, sql } from 'drizzle-orm';

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

    const recipientFilter = sql`COALESCE(${notifications.recipientId}, ${notifications.memberId}) = ${auth.id}`;
    const whereCondition = unreadOnly
      ? and(sql`${recipientFilter}`, eq(notifications.isRead, false))
      : sql`${recipientFilter}`;

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        link: notifications.link,
        is_read: notifications.isRead,
        created_at: notifications.createdAt,
        ticket_id: notifications.ticketId,
        entity_type: notifications.entityType,
        actor_name: members.displayName,
      })
      .from(notifications)
      .leftJoin(members, eq(members.id, sql`COALESCE(${notifications.actorId}, ${notifications.memberId})`))
      .where(whereCondition!)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Marca notificação(s) como lida(s) — APENAS as do usuário autenticado.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');

    let bodyId: string | undefined;
    try {
      const body = await request.json();
      bodyId = body?.id;
    } catch {
      // sem body = mark all read
    }

    const targetId = queryId || bodyId;

    if (targetId) {
      await db.update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, targetId),
          sql`COALESCE(${notifications.recipientId}, ${notifications.memberId}) = ${auth.id}`
        ));
      return NextResponse.json({ ok: true });
    }

    // Sem id → marca todas do user como lidas
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.isRead, false),
        sql`COALESCE(${notifications.recipientId}, ${notifications.memberId}) = ${auth.id}`
      ));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/notifications error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
