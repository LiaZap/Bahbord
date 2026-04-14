import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');

  if (!ticketId) {
    return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
  }

  const result = await query(
    `SELECT a.id, a.action, a.field_name, a.old_value, a.new_value, a.created_at,
      m.display_name AS actor_name
    FROM activity_log a
    LEFT JOIN members m ON m.id = COALESCE(a.actor_id, a.member_id)
    WHERE a.ticket_id = $1
    ORDER BY a.created_at DESC`,
    [ticketId]
  );

  return NextResponse.json(result.rows);
}
