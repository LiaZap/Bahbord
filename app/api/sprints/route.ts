import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';

export async function GET() {
  try {
    const wsId = await getDefaultWorkspaceId();

    const result = await query(
      `SELECT s.id, s.name, s.goal, s.start_date, s.end_date, s.is_active, s.is_completed, s.created_at, s.completed_at,
        COUNT(t.id)::int AS ticket_count,
        COUNT(t.id) FILTER (WHERE st.is_done = true)::int AS done_count
      FROM sprints s
      LEFT JOIN tickets t ON t.sprint_id = s.id AND t.is_archived = false
      LEFT JOIN statuses st ON st.id = t.status_id
      WHERE s.workspace_id = $1
      GROUP BY s.id
      ORDER BY s.is_active DESC, s.created_at DESC`,
      [wsId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, goal, start_date, end_date } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    const wsId = await getDefaultWorkspaceId();

    const result = await query(
      `INSERT INTO sprints (workspace_id, name, goal, start_date, end_date, is_active, is_completed)
       VALUES ($1, $2, $3, $4, $5, false, false)
       RETURNING *`,
      [wsId, name.trim(), goal || null, start_date || null, end_date || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    if (action === 'activate') {
      const wsId = await getDefaultWorkspaceId();
      // Desativa todos primeiro
      await query(
        `UPDATE sprints SET is_active = false WHERE workspace_id = $1`,
        [wsId]
      );
      const result = await query(
        `UPDATE sprints SET is_active = true WHERE id = $1 RETURNING *`,
        [id]
      );
      return NextResponse.json(result.rows[0]);
    }

    if (action === 'complete') {
      const result = await query(
        `UPDATE sprints SET is_completed = true, is_active = false, completed_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      return NextResponse.json(result.rows[0]);
    }

    // Generic field update
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (['name', 'goal', 'start_date', 'end_date'].includes(key)) {
        sets.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE sprints SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    // Verificar se tem tickets associados
    const check = await query(`SELECT COUNT(*)::int AS cnt FROM tickets WHERE sprint_id = $1`, [id]);
    if (check.rows[0].cnt > 0) {
      return NextResponse.json(
        { error: `Não é possível remover: ${check.rows[0].cnt} ticket(s) associado(s) a este sprint` },
        { status: 409 }
      );
    }

    const result = await query(`DELETE FROM sprints WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Sprint não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
