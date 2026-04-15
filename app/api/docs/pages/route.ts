import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const spaceId = searchParams.get('space_id');
    const folderId = searchParams.get('folder_id');
    const search = searchParams.get('search');

    // Single page by ID
    if (id) {
      const result = await query(
        `SELECT p.*, m1.display_name AS created_by_name, m2.display_name AS updated_by_name
         FROM doc_pages p
         LEFT JOIN members m1 ON m1.id = p.created_by
         LEFT JOIN members m2 ON m2.id = p.updated_by
         WHERE p.id = $1`,
        [id]
      );
      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
      }
      return NextResponse.json(result.rows[0]);
    }

    // Search pages by title
    if (search && search.trim().length >= 2) {
      const searchPattern = `%${search.trim()}%`;
      const result = await query(
        `SELECT p.id, p.title, p.space_id, p.folder_id, p.updated_at,
                ds.name AS space_name, ds.icon AS space_icon
         FROM doc_pages p
         JOIN doc_spaces ds ON ds.id = p.space_id
         WHERE p.title ILIKE $1 AND p.is_published = true
         ORDER BY p.updated_at DESC
         LIMIT 15`,
        [searchPattern]
      );
      return NextResponse.json(result.rows);
    }

    // List pages by space/folder
    if (!spaceId) {
      return NextResponse.json({ error: 'space_id é obrigatório' }, { status: 400 });
    }

    let sql: string;
    let params: unknown[];

    if (folderId) {
      sql = `SELECT id, space_id, folder_id, title, is_published, created_at, updated_at
             FROM doc_pages
             WHERE space_id = $1 AND folder_id = $2
             ORDER BY title ASC`;
      params = [spaceId, folderId];
    } else {
      sql = `SELECT id, space_id, folder_id, title, is_published, created_at, updated_at
             FROM doc_pages
             WHERE space_id = $1 AND folder_id IS NULL
             ORDER BY title ASC`;
      params = [spaceId];
    }

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/docs/pages error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { space_id, folder_id, title, content } = body;

    if (!space_id || !title?.trim()) {
      return NextResponse.json({ error: 'space_id e title são obrigatórios' }, { status: 400 });
    }

    let memberId: string | null = null;
    try { memberId = await getDefaultMemberId(); } catch { /* no member */ }

    const result = await query(
      `INSERT INTO doc_pages (space_id, folder_id, title, content, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [space_id, folder_id || null, title.trim(), content || '', memberId]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/docs/pages error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { id, title, content } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    let memberId: string | null = null;
    try { memberId = await getDefaultMemberId(); } catch { /* no member */ }

    const result = await query(
      `UPDATE doc_pages
       SET title = COALESCE($2, title),
           content = COALESCE($3, content),
           updated_by = COALESCE($4, updated_by),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, title || null, content !== undefined ? content : null, memberId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/docs/pages error:', err);
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

    const result = await query('DELETE FROM doc_pages WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Página não encontrada' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/docs/pages error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
