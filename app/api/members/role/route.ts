import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { member_id, role } = await request.json();

    if (!member_id || !role) {
      return NextResponse.json({ error: 'member_id e role são obrigatórios' }, { status: 400 });
    }

    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Role inválido' }, { status: 400 });
    }

    // Get workspace_id from member
    const memberResult = await query(
      `SELECT workspace_id FROM members WHERE id = $1`,
      [member_id]
    );

    if (memberResult.rowCount === 0) {
      return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 });
    }

    const workspaceId = memberResult.rows[0].workspace_id;

    // Upsert org_roles
    await query(
      `INSERT INTO org_roles (workspace_id, member_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, member_id)
       DO UPDATE SET role = $3`,
      [workspaceId, member_id, role]
    );

    // Also update the legacy role column on members table
    await query(`UPDATE members SET role = $1 WHERE id = $2`, [role, member_id]);

    return NextResponse.json({ ok: true, role });
  } catch (err) {
    console.error('PATCH /api/members/role error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
