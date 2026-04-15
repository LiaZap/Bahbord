import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET() {
  try {
    const workspaceId = await getDefaultWorkspaceId();
    const result = await query(
      `SELECT id, name, description, icon, is_public, created_at, updated_at
       FROM doc_spaces
       WHERE workspace_id = $1
       ORDER BY created_at ASC`,
      [workspaceId]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/docs/spaces error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const workspaceId = await getDefaultWorkspaceId();
    const body = await request.json();
    const { name, description, icon } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO doc_spaces (workspace_id, name, description, icon)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [workspaceId, name.trim(), description || null, icon || '📚']
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/docs/spaces error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { id, name, description, icon } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `UPDATE doc_spaces
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           icon = COALESCE($4, icon),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, name || null, description, icon || null]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/docs/spaces error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const result = await query('DELETE FROM doc_spaces WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/docs/spaces error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
