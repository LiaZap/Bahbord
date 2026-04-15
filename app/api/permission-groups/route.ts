import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const workspaceId = await getDefaultWorkspaceId();

    const result = await query(
      `SELECT pg.id, pg.name, pg.created_at,
              COUNT(p.id)::int AS permission_count
       FROM permission_groups pg
       LEFT JOIN permissions p ON p.group_id = pg.id
       WHERE pg.workspace_id = $1
       GROUP BY pg.id, pg.name, pg.created_at
       ORDER BY pg.name ASC`,
      [workspaceId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/permission-groups error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (auth && !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;
    const workspaceId = await getDefaultWorkspaceId();

    if (!name) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO permission_groups (workspace_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [workspaceId, name]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/permission-groups error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (auth && !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    // Check if group has permissions
    const check = await query(
      `SELECT COUNT(*)::int AS count FROM permissions WHERE group_id = $1`,
      [id]
    );

    if (check.rows[0].count > 0) {
      return NextResponse.json(
        { error: 'Não é possível remover um grupo que possui permissões vinculadas' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM permission_groups WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/permission-groups error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
