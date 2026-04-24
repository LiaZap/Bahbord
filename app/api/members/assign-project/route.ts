import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { member_id, project_id, role = 'member' } = await request.json();
    if (!member_id || !project_id) {
      return NextResponse.json({ error: 'member_id e project_id são obrigatórios' }, { status: 400 });
    }

    await query(
      `INSERT INTO project_roles (project_id, member_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, member_id) DO UPDATE SET role = $3`,
      [project_id, member_id, role]
    );

    // Auto-approve when assigning to a project (admin-led flow)
    await query(`UPDATE members SET is_approved = true WHERE id = $1`, [member_id]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/members/assign-project error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { member_id, project_id } = await request.json();
    if (!member_id || !project_id) {
      return NextResponse.json({ error: 'member_id e project_id são obrigatórios' }, { status: 400 });
    }

    await query(
      `DELETE FROM project_roles WHERE member_id = $1 AND project_id = $2`,
      [member_id, project_id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/members/assign-project error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
