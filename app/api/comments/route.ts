import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');

  if (!ticketId) {
    return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
  }

  const result = await query(
    `SELECT
      c.id, c.body, c.created_at, c.updated_at,
      m.display_name AS author_name, m.email AS author_email
    FROM comments c
    JOIN members m ON m.id = c.author_id
    WHERE c.ticket_id = $1
    ORDER BY c.created_at ASC`,
    [ticketId]
  );

  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { ticket_id, author_id, content } = body;

  if (!ticket_id || !content?.trim()) {
    return NextResponse.json({ error: 'ticket_id e content são obrigatórios' }, { status: 400 });
  }

  let memberId = author_id;
  if (!memberId) {
    try {
      memberId = await getDefaultMemberId();
    } catch {
      return NextResponse.json({ error: 'Nenhum membro encontrado' }, { status: 400 });
    }
  }

  const result = await query(
    `INSERT INTO comments (ticket_id, author_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, body, created_at`,
    [ticket_id, memberId, content.trim()]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, content } = body;

  if (!id || !content?.trim()) {
    return NextResponse.json({ error: 'id e content são obrigatórios' }, { status: 400 });
  }

  const result = await query(
    `UPDATE comments SET body = $1, updated_at = NOW() WHERE id = $2 RETURNING id, body, updated_at`,
    [content.trim(), id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  }

  const result = await query(`DELETE FROM comments WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
