import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const workspaceId = await getDefaultWorkspaceId();

    let sql = `
      SELECT p.id, p.key, p.display_name, p.group_id, p.scope, p.created_at,
             pg.name AS group_name
      FROM permissions p
      LEFT JOIN permission_groups pg ON pg.id = p.group_id
      WHERE p.workspace_id = $1
    `;
    const params: unknown[] = [workspaceId];

    if (groupId) {
      sql += ` AND p.group_id = $2`;
      params.push(groupId);
    }

    sql += ` ORDER BY pg.name ASC, p.key ASC`;

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/permissions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { key, display_name, group_id, scope } = body;
    const workspaceId = await getDefaultWorkspaceId();

    if (!key || !display_name) {
      return NextResponse.json({ error: 'key e display_name são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO permissions (workspace_id, key, display_name, group_id, scope)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [workspaceId, key, display_name, group_id || null, scope || 'both']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/permissions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, display_name, group_id, scope } = body;

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `UPDATE permissions
       SET display_name = COALESCE($2, display_name),
           group_id = COALESCE($3, group_id),
           scope = COALESCE($4, scope)
       WHERE id = $1
       RETURNING *`,
      [id, display_name, group_id, scope]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Permissão não encontrada' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/permissions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM permissions WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Permissão não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/permissions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
