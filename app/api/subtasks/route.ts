import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const result = await query(
      `SELECT s.id, s.title, s.is_completed, s.position, s.created_at, s.completed_at,
        m.display_name AS assignee_name
      FROM subtasks s
      LEFT JOIN members m ON m.id = s.assignee_id
      WHERE s.ticket_id = $1
      ORDER BY s.position ASC, s.created_at ASC`,
      [ticketId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { ticket_id, title } = body;

    if (!ticket_id || !title?.trim()) {
      return NextResponse.json({ error: 'ticket_id e title são obrigatórios' }, { status: 400 });
    }

    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM subtasks WHERE ticket_id = $1`,
      [ticket_id]
    );
    const nextPos = posResult.rows[0].next_pos;

    const result = await query(
      `INSERT INTO subtasks (ticket_id, title, position, is_completed)
       VALUES ($1, $2, $3, false)
       RETURNING *`,
      [ticket_id, title.trim(), nextPos]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { id, is_completed, title, position } = body;

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (typeof is_completed === 'boolean') {
      sets.push(`is_completed = $${idx}`);
      params.push(is_completed);
      idx++;
      if (is_completed) {
        sets.push(`completed_at = NOW()`);
      } else {
        sets.push(`completed_at = NULL`);
      }
    }

    if (typeof title === 'string') {
      sets.push(`title = $${idx}`);
      params.push(title.trim());
      idx++;
    }

    if (typeof position === 'number') {
      sets.push(`position = $${idx}`);
      params.push(position);
      idx++;
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    params.push(id);
    const result = await query(
      `UPDATE subtasks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    await query(`DELETE FROM subtasks WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
