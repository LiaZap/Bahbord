import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticketId);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const result = await query(
      `SELECT s.id, s.title, s.is_done AS is_completed, s.position, s.created_at, s.completed_at
      FROM subtasks s
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
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { ticket_id, title } = body;

    if (!ticket_id || !title?.trim()) {
      return NextResponse.json({ error: 'ticket_id e title são obrigatórios' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticket_id);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM subtasks WHERE ticket_id = $1`,
      [ticket_id]
    );
    const nextPos = posResult.rows[0].next_pos;

    const result = await query(
      `INSERT INTO subtasks (ticket_id, title, position, is_done)
       VALUES ($1, $2, $3, false)
       RETURNING id, title, is_done AS is_completed, position, created_at, completed_at`,
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
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { id, is_completed, title, position } = body;

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    // Resolve ticket_id da subtask para checar acesso ao ticket pai
    const subRes = await query<{ ticket_id: string }>(
      `SELECT ticket_id FROM subtasks WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!subRes.rows[0]) {
      return NextResponse.json({ error: 'Subtask não encontrada' }, { status: 404 });
    }
    const allowed = await hasTicketAccess(auth, subRes.rows[0].ticket_id);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (typeof is_completed === 'boolean') {
      sets.push(`is_done = $${idx}`);
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
      `UPDATE subtasks SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, title, is_done AS is_completed, position, created_at, completed_at`,
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
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const subRes = await query<{ ticket_id: string }>(
      `SELECT ticket_id FROM subtasks WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!subRes.rows[0]) {
      return NextResponse.json({ error: 'Subtask não encontrada' }, { status: 404 });
    }
    const allowed = await hasTicketAccess(auth, subRes.rows[0].ticket_id);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    await query(`DELETE FROM subtasks WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/subtasks error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
