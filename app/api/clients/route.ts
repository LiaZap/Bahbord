import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `SELECT c.id, c.name, c.color, c.contact_email, c.contact_phone, c.is_active,
        c.organization_id, c.created_at,
        o.name AS organization_name,
        (SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id)::int AS ticket_count
       FROM clients c
       LEFT JOIN organizations o ON o.id = c.organization_id
       WHERE c.workspace_id = $1
       ORDER BY c.name ASC`,
      [workspaceId]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/clients error:', err);
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
    const { name, color, contact_email, contact_phone, organization_id } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `INSERT INTO clients (workspace_id, name, color, contact_email, contact_phone, organization_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [workspaceId, name.trim(), color || '#6366f1', contact_email || null, contact_phone || null, organization_id || null]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/clients error:', err);
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
    const { id, name, color, contact_email, contact_phone, organization_id, is_active } = body;
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx}`); values.push(name); idx++; }
    if (color !== undefined) { sets.push(`color = $${idx}`); values.push(color); idx++; }
    if (contact_email !== undefined) { sets.push(`contact_email = $${idx}`); values.push(contact_email); idx++; }
    if (contact_phone !== undefined) { sets.push(`contact_phone = $${idx}`); values.push(contact_phone); idx++; }
    if (organization_id !== undefined) { sets.push(`organization_id = $${idx}`); values.push(organization_id || null); idx++; }
    if (is_active !== undefined) { sets.push(`is_active = $${idx}`); values.push(is_active); idx++; }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }
    values.push(id);
    const result = await query(
      `UPDATE clients SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/clients error:', err);
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
    const check = await query(`SELECT COUNT(*) AS cnt FROM tickets WHERE client_id = $1`, [id]);
    if (parseInt(check.rows[0].cnt) > 0) {
      return NextResponse.json({ error: 'Não é possível remover: existem tickets vinculados a este cliente' }, { status: 409 });
    }
    await query(`DELETE FROM clients WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/clients error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
