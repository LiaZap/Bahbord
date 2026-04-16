import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const workspaceId = searchParams.get('workspace_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (projectId) {
      conditions.push(`c.project_id = $${idx}`);
      values.push(projectId);
      idx++;
    }

    if (workspaceId) {
      conditions.push(`c.workspace_id = $${idx}`);
      values.push(workspaceId);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit);

    const result = await query(
      `SELECT c.id, c.workspace_id, c.project_id, c.member_id,
              c.entity_type, c.entity_id, c.action, c.details,
              c.commit_hash, c.created_at,
              m.display_name AS member_name
       FROM changelog c
       LEFT JOIN members m ON m.id = c.member_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${idx}`,
      values
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/changelog error:', err);
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
    const { workspace_id, project_id, member_id, entity_type, entity_id, action, details, commit_hash } = body;

    if (!entity_type || !action) {
      return NextResponse.json({ error: 'entity_type e action são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO changelog (workspace_id, project_id, member_id, entity_type, entity_id, action, details, commit_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        workspace_id || null,
        project_id || null,
        member_id || null,
        entity_type,
        entity_id || null,
        action,
        details ? JSON.stringify(details) : '{}',
        commit_hash || null,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/changelog error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
