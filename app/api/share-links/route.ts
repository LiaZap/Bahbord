import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hashSharePassword, generateSlug } from '@/lib/share-links';
import { logAudit, extractRequestMeta } from '@/lib/audit';

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const workspaceId = auth.workspace_id;

    const result = await query(
      `SELECT
         sl.id, sl.slug, sl.project_id, sl.board_id,
         sl.expires_at, sl.views_count, sl.created_at,
         (sl.password_hash IS NOT NULL) AS has_password,
         p.name AS project_name, p.color AS project_color,
         b.name AS board_name,
         m.display_name AS created_by_name
       FROM share_links sl
       LEFT JOIN projects p ON p.id = sl.project_id
       LEFT JOIN boards b ON b.id = sl.board_id
       LEFT JOIN members m ON m.id = sl.created_by
       WHERE sl.workspace_id = $1
       ORDER BY sl.created_at DESC`,
      [workspaceId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/share-links error:', err);
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
    const { project_id, board_id, password, expires_at } = body as {
      project_id?: string;
      board_id?: string;
      password?: string;
      expires_at?: string | null;
    };

    if (!project_id && !board_id) {
      return NextResponse.json(
        { error: 'project_id ou board_id é obrigatório' },
        { status: 400 }
      );
    }

    const workspaceId = auth.workspace_id;

    // Garantir slug único
    let slug = generateSlug();
    for (let attempt = 0; attempt < 5; attempt++) {
      const check = await query(`SELECT 1 FROM share_links WHERE slug = $1`, [slug]);
      if (check.rowCount === 0) break;
      slug = generateSlug();
    }

    const passwordHash = password && password.trim() ? hashSharePassword(password.trim()) : null;

    const result = await query(
      `INSERT INTO share_links (workspace_id, project_id, board_id, slug, password_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, slug, project_id, board_id, expires_at, created_at`,
      [
        workspaceId,
        project_id || null,
        board_id || null,
        slug,
        passwordHash,
        expires_at || null,
        auth.id,
      ]
    );

    const created = result.rows[0] as { id: string; slug: string; project_id: string | null; board_id: string | null };
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: auth.id,
      action: 'share_link.created',
      entityType: 'share_link',
      entityId: created.id,
      changes: {
        slug: created.slug,
        project_id: created.project_id,
        board_id: created.board_id,
        has_password: !!passwordHash,
        expires_at: expires_at || null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/share-links error:', err);
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

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const workspaceId = auth.workspace_id;

    const result = await query<{ id: string; slug: string }>(
      `DELETE FROM share_links WHERE id = $1 AND workspace_id = $2 RETURNING id, slug`,
      [id, workspaceId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Share link não encontrado' }, { status: 404 });
    }

    const deleted = result.rows[0];
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: auth.id,
      action: 'share_link.revoked',
      entityType: 'share_link',
      entityId: deleted.id,
      changes: { slug: deleted.slug },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/share-links error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
