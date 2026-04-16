import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

const SCOPE_TABLES: Record<string, { table: string; fk: string }> = {
  org: { table: 'org_roles', fk: 'workspace_id' },
  project: { table: 'project_roles', fk: 'project_id' },
  board: { table: 'board_roles', fk: 'board_id' },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const scopeId = searchParams.get('scope_id');

    if (!scope || !scopeId || !SCOPE_TABLES[scope]) {
      return NextResponse.json({ error: 'scope (org|project|board) e scope_id são obrigatórios' }, { status: 400 });
    }

    const { table, fk } = SCOPE_TABLES[scope];

    const result = await query(
      `SELECT r.id, r.member_id, r.role, r.created_at,
              m.display_name, m.email
       FROM ${table} r
       JOIN members m ON m.id = r.member_id
       WHERE r.${fk} = $1
       ORDER BY r.role ASC, m.display_name ASC`,
      [scopeId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/roles error:', err);
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
    const { scope, scope_id, member_id, role } = body;

    if (!scope || !scope_id || !member_id || !role) {
      return NextResponse.json({ error: 'scope, scope_id, member_id e role são obrigatórios' }, { status: 400 });
    }

    if (!SCOPE_TABLES[scope]) {
      return NextResponse.json({ error: 'scope inválido. Use: org, project, board' }, { status: 400 });
    }

    const { table, fk } = SCOPE_TABLES[scope];

    const result = await query(
      `INSERT INTO ${table} (${fk}, member_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (${fk}, member_id) DO UPDATE SET role = $3
       RETURNING *`,
      [scope_id, member_id, role]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/roles error:', err);
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
    const scope = searchParams.get('scope');

    if (!id || !scope || !SCOPE_TABLES[scope]) {
      return NextResponse.json({ error: 'id e scope (org|project|board) são obrigatórios' }, { status: 400 });
    }

    const { table } = SCOPE_TABLES[scope];

    const result = await query(
      `DELETE FROM ${table} WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Role não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/roles error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
