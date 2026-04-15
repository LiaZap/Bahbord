import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('space_id');
    const parentId = searchParams.get('parent_id');

    if (!spaceId) {
      return NextResponse.json({ error: 'space_id é obrigatório' }, { status: 400 });
    }

    let sql: string;
    let params: unknown[];

    if (parentId) {
      sql = `SELECT id, space_id, parent_id, name, position, created_at
             FROM doc_folders
             WHERE space_id = $1 AND parent_id = $2
             ORDER BY position ASC, name ASC`;
      params = [spaceId, parentId];
    } else {
      sql = `SELECT id, space_id, parent_id, name, position, created_at
             FROM doc_folders
             WHERE space_id = $1 AND parent_id IS NULL
             ORDER BY position ASC, name ASC`;
      params = [spaceId];
    }

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/docs/folders error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { space_id, parent_id, name } = body;

    if (!space_id || !name?.trim()) {
      return NextResponse.json({ error: 'space_id e name são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO doc_folders (space_id, parent_id, name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [space_id, parent_id || null, name.trim()]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/docs/folders error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { id, name } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `UPDATE doc_folders SET name = COALESCE($2, name) WHERE id = $1 RETURNING *`,
      [id, name || null]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Pasta não encontrada' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/docs/folders error:', err);
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

    const result = await query('DELETE FROM doc_folders WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Pasta não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/docs/folders error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
