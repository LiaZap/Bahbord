import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';

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

  let memberId: string;
  try {
    memberId = await getDefaultMemberId();
  } catch {
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

  // Log manual: action = 'log'
  if (action === 'log') {
    const { duration_minutes, description } = body;
    if (!duration_minutes || duration_minutes <= 0) {
      return NextResponse.json({ error: 'duration_minutes deve ser > 0' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO time_entries (ticket_id, member_id, started_at, ended_at, duration_minutes, is_running, description)
       VALUES ($1, $2, NOW() - ($3 || ' minutes')::interval, NOW(), $3, false, $4)
       RETURNING *`,
      [ticket_id, memberId, duration_minutes, description || null]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  }

  return NextResponse.json({ error: 'action deve ser start, stop ou log' }, { status: 400 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, description, duration_minutes } = body;

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (description !== undefined) {
    sets.push(`description = $${idx}`);
    values.push(description);
    idx++;
  }

  if (duration_minutes !== undefined) {
    sets.push(`duration_minutes = $${idx}`);
    values.push(duration_minutes);
    idx++;
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  values.push(id);
  const result = await query(
    `UPDATE time_entries SET ${sets.join(', ')} WHERE id = $${idx} AND is_running = false RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Entrada não encontrada ou timer em execução' }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
  }

  const result = await query(
    `DELETE FROM time_entries WHERE id = $1 AND is_running = false`,
    [id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Entrada não encontrada ou timer em execução' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
