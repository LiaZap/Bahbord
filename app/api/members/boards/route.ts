import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');

    if (!memberId) {
      return NextResponse.json({ error: 'member_id obrigatório' }, { status: 400 });
    }

    const result = await query(
      `SELECT br.board_id, b.name AS board_name, p.name AS project_name, br.role
       FROM board_roles br
       JOIN boards b ON b.id = br.board_id
       JOIN projects p ON p.id = b.project_id
       WHERE br.member_id = $1
       ORDER BY p.name, b.name`,
      [memberId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/members/boards error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
