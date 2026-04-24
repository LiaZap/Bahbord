import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { member_id, board_id, role = 'member' } = await request.json();

    if (!member_id || !board_id) {
      return NextResponse.json({ error: 'member_id e board_id são obrigatórios' }, { status: 400 });
    }

    await query(
      `INSERT INTO board_roles (board_id, member_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (board_id, member_id) DO UPDATE SET role = $3`,
      [board_id, member_id, role]
    );

    // Grant viewer on project so they see the project in sidebar
    const boardProject = await query(`SELECT project_id FROM boards WHERE id = $1`, [board_id]);
    if (boardProject.rows[0]) {
      await query(
        `INSERT INTO project_roles (project_id, member_id, role)
         VALUES ($1, $2, 'viewer')
         ON CONFLICT (project_id, member_id) DO NOTHING`,
        [boardProject.rows[0].project_id, member_id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/members/assign-board error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { member_id, board_id } = await request.json();

    if (!member_id || !board_id) {
      return NextResponse.json({ error: 'member_id e board_id são obrigatórios' }, { status: 400 });
    }

    await query(
      `DELETE FROM board_roles WHERE member_id = $1 AND board_id = $2`,
      [member_id, board_id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/members/assign-board error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
