import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `SELECT p.id, p.name, p.color, p.description, p.is_active, p.created_at,
        (SELECT COUNT(*) FROM client_products cp WHERE cp.product_id = p.id)::int AS client_count
       FROM products p
       WHERE p.workspace_id = $1
       ORDER BY p.name ASC`,
      [workspaceId]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/products error:', err);
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
    const { name, color, description } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `INSERT INTO products (workspace_id, name, color, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [workspaceId, name.trim(), color || '#6366f1', description || null]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/products error:', err);
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
    const { id, name, color, description, is_active } = body;
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx}`); values.push(name); idx++; }
    if (color !== undefined) { sets.push(`color = $${idx}`); values.push(color); idx++; }
    if (description !== undefined) { sets.push(`description = $${idx}`); values.push(description); idx++; }
    if (is_active !== undefined) { sets.push(`is_active = $${idx}`); values.push(is_active); idx++; }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }
    values.push(id);
    const result = await query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/products error:', err);
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
    // Remove links first, then the product
    await query(`DELETE FROM client_products WHERE product_id = $1`, [id]);
    await query(`DELETE FROM products WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/products error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
