import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const workspaceId = await getDefaultWorkspaceId();

    if (!role) {
      return NextResponse.json({ error: 'role é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `SELECT rp.id, rp.role_name, rp.permission_id, rp.created_at,
              p.key, p.display_name, p.scope,
              pg.name AS group_name
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       LEFT JOIN permission_groups pg ON pg.id = p.group_id
       WHERE rp.role_name = $1 AND rp.workspace_id = $2
       ORDER BY pg.name ASC, p.key ASC`,
      [role, workspaceId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/role-permissions error:', err);
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
    const { role_name, permission_id } = body;
    const workspaceId = await getDefaultWorkspaceId();

    if (!role_name || !permission_id) {
      return NextResponse.json({ error: 'role_name e permission_id são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO role_permissions (role_name, permission_id, workspace_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (role_name, permission_id) DO NOTHING
       RETURNING *`,
      [role_name, permission_id, workspaceId]
    );

    return NextResponse.json(result.rows[0] || { already_exists: true }, { status: 201 });
  } catch (err) {
    console.error('POST /api/role-permissions error:', err);
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
      `DELETE FROM role_permissions WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Atribuição não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/role-permissions error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
