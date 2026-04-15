import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId, getDefaultMemberId } from '@/lib/db';

export async function GET() {
  try {
    const workspaceId = await getDefaultWorkspaceId();
    const memberId = await getDefaultMemberId();

    const result = await query(
      `SELECT sf.*, m.display_name AS creator_name
       FROM saved_filters sf
       LEFT JOIN members m ON m.id = sf.member_id
       WHERE sf.workspace_id = $1
         AND (sf.is_shared = true OR sf.member_id = $2)
       ORDER BY sf.created_at DESC`,
      [workspaceId, memberId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/filters error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, filter_config, is_shared } = body;

    if (!name || !filter_config) {
      return NextResponse.json({ error: 'Nome e configuração são obrigatórios' }, { status: 400 });
    }

    const workspaceId = await getDefaultWorkspaceId();
    const memberId = await getDefaultMemberId();

    const result = await query(
      `INSERT INTO saved_filters (workspace_id, member_id, name, filter_config, is_shared)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [workspaceId, memberId, name, JSON.stringify(filter_config), is_shared ?? false]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/filters error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, name, filter_config, is_shared } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(name);
    }
    if (filter_config !== undefined) {
      sets.push(`filter_config = $${idx++}`);
      params.push(JSON.stringify(filter_config));
    }
    if (is_shared !== undefined) {
      sets.push(`is_shared = $${idx++}`);
      params.push(is_shared);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    params.push(id);
    const result = await query(
      `UPDATE saved_filters SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Filtro não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/filters error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM saved_filters WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Filtro não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /api/filters error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
