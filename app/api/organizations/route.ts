import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `SELECT o.id, o.name, o.domain, o.logo_url, o.created_at,
        (SELECT COUNT(*) FROM clients c WHERE c.organization_id = o.id)::int AS client_count
       FROM organizations o
       WHERE o.workspace_id = $1
       ORDER BY o.name ASC`,
      [workspaceId]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/organizations error:', err);
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
    const { name, domain, logo_url } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `INSERT INTO organizations (workspace_id, name, domain, logo_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [workspaceId, name.trim(), domain || null, logo_url || null]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/organizations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (auth && !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, domain, logo_url } = body;
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx}`); values.push(name); idx++; }
    if (domain !== undefined) { sets.push(`domain = $${idx}`); values.push(domain); idx++; }
    if (logo_url !== undefined) { sets.push(`logo_url = $${idx}`); values.push(logo_url); idx++; }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }
    values.push(id);
    const result = await query(
      `UPDATE organizations SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/organizations error:', err);
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
    // Check if org has clients
    const check = await query(`SELECT COUNT(*) AS cnt FROM clients WHERE organization_id = $1`, [id]);
    if (parseInt(check.rows[0].cnt) > 0) {
      return NextResponse.json({ error: 'Não é possível remover: existem clientes vinculados a esta organização' }, { status: 409 });
    }
    await query(`DELETE FROM organizations WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/organizations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
