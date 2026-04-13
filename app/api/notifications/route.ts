import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  const result = await query(
    `SELECT n.id, n.type, n.title, n.message, n.is_read, n.created_at,
      n.ticket_id,
      m.display_name AS actor_name,
      tf.ticket_key
    FROM notifications n
    LEFT JOIN members m ON m.id = n.actor_id
    LEFT JOIN tickets_full tf ON tf.id = n.ticket_id
    ORDER BY n.created_at DESC
    LIMIT 30`
  );

  return NextResponse.json(result.rows);
}

export async function PATCH(request: Request) {
  const body = await request.json();

  if (body.action === 'read_all') {
    await query(`UPDATE notifications SET is_read = true WHERE is_read = false`);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await query(`UPDATE notifications SET is_read = true WHERE id = $1`, [body.id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'action ou id obrigatório' }, { status: 400 });
}
