import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';

export async function GET() {
  try {
    const workspaceId = await getDefaultWorkspaceId();

    const result = await query(
      `SELECT
        t.id, t.name, t.description, t.color, t.created_at,
        COUNT(tm.member_id)::int AS member_count,
        COALESCE(
          json_agg(
            json_build_object('id', m.id, 'display_name', m.display_name, 'email', m.email, 'role', tm.role)
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) AS members
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN members m ON m.id = tm.member_id
      WHERE t.workspace_id = $1
      GROUP BY t.id
      ORDER BY t.name ASC`,
      [workspaceId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/teams error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    const workspaceId = await getDefaultWorkspaceId();

    const result = await query(
      `INSERT INTO teams (workspace_id, name, description, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [workspaceId, name.trim(), description || null, color || '#6366f1']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/teams error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, member_id, role, name, description, color } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // Add member to team
    if (action === 'add_member') {
      if (!member_id) {
        return NextResponse.json({ error: 'member_id é obrigatório' }, { status: 400 });
      }
      await query(
        `INSERT INTO team_members (team_id, member_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (team_id, member_id) DO UPDATE SET role = $3`,
        [id, member_id, role || 'member']
      );
      return NextResponse.json({ success: true });
    }

    // Remove member from team
    if (action === 'remove_member') {
      if (!member_id) {
        return NextResponse.json({ error: 'member_id é obrigatório' }, { status: 400 });
      }
      await query(
        `DELETE FROM team_members WHERE team_id = $1 AND member_id = $2`,
        [id, member_id]
      );
      return NextResponse.json({ success: true });
    }

    // Update team fields
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx}`); values.push(name); idx++; }
    if (description !== undefined) { sets.push(`description = $${idx}`); values.push(description); idx++; }
    if (color !== undefined) { sets.push(`color = $${idx}`); values.push(color); idx++; }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE teams SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/teams error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM teams WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/teams error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
