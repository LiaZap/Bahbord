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

  // Se não tiver author_id, pegar o primeiro member do workspace
  let memberId = author_id;
  if (!memberId) {
    const memberResult = await query(`SELECT id FROM members LIMIT 1`);
    memberId = memberResult.rows[0]?.id;
  }

  if (!memberId) {
    return NextResponse.json({ error: 'Nenhum membro encontrado' }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO comments (ticket_id, author_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, body, created_at`,
    [ticket_id, memberId, content.trim()]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}
