import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');

  if (!ticketId) {
    return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
  }

  const result = await query(
    `SELECT
      tl.id, tl.link_type, tl.source_ticket_id, tl.target_ticket_id,
      CASE WHEN tl.source_ticket_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
      tf.ticket_key, tf.title, tf.status_name, tf.status_color
    FROM ticket_links tl
    JOIN tickets_full tf ON tf.id = CASE
      WHEN tl.source_ticket_id = $1 THEN tl.target_ticket_id
      ELSE tl.source_ticket_id
    END
    WHERE tl.source_ticket_id = $1 OR tl.target_ticket_id = $1
    ORDER BY tl.created_at DESC`,
    [ticketId]
  );

  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { source_ticket_id, target_ticket_id, link_type } = body;

  if (!source_ticket_id || !target_ticket_id || !link_type) {
    return NextResponse.json({ error: 'source_ticket_id, target_ticket_id e link_type são obrigatórios' }, { status: 400 });
  }

  const validTypes = ['blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by'];
  if (!validTypes.includes(link_type)) {
    return NextResponse.json({ error: 'link_type inválido' }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO ticket_links (source_ticket_id, target_ticket_id, link_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [source_ticket_id, target_ticket_id, link_type]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  }

  await query(`DELETE FROM ticket_links WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
