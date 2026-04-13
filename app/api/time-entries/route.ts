import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get('ticket_id');

  if (!ticketId) {
    return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
  }

  const result = await query(
    `SELECT te.id, te.description, te.started_at, te.ended_at,
      te.duration_minutes, te.is_running, te.created_at,
      m.display_name AS member_name
    FROM time_entries te
    LEFT JOIN members m ON m.id = te.member_id
    WHERE te.ticket_id = $1
    ORDER BY te.created_at DESC`,
    [ticketId]
  );

  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { ticket_id, action } = body;

  if (!ticket_id) {
    return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
  }

  // Buscar membro padrão
  const memberResult = await query(`SELECT id FROM members LIMIT 1`);
  const memberId = memberResult.rows[0]?.id;
  if (!memberId) {
    return NextResponse.json({ error: 'Nenhum membro encontrado' }, { status: 400 });
  }

  if (action === 'start') {
    // Parar qualquer timer rodando para este ticket
    await query(
      `UPDATE time_entries SET is_running = false, ended_at = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
      WHERE ticket_id = $1 AND is_running = true`,
      [ticket_id]
    );

    const result = await query(
      `INSERT INTO time_entries (ticket_id, member_id, started_at, is_running)
       VALUES ($1, $2, NOW(), true)
       RETURNING *`,
      [ticket_id, memberId]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  }

  if (action === 'stop') {
    const result = await query(
      `UPDATE time_entries SET is_running = false, ended_at = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
      WHERE ticket_id = $1 AND is_running = true
      RETURNING *`,
      [ticket_id]
    );
    return NextResponse.json(result.rows[0] || { ok: true });
  }

  return NextResponse.json({ error: 'action deve ser start ou stop' }, { status: 400 });
}
