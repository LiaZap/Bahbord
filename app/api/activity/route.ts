import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json([], { status: 200 });
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const limitParam = parseInt(searchParams.get('limit') || '12', 10);
    const limit = Math.min(50, Math.max(1, limitParam));

    const isValidUuid = projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);

    const params: unknown[] = [limit];
    let projectFilter = '';
    if (isValidUuid) {
      params.push(projectId);
      projectFilter = ` AND t.project_id = $${params.length}`;
    }

    const userIsAdmin = isAdmin(auth.role);
    let accessFilter = '';
    if (!userIsAdmin) {
      params.push(auth.id);
      const idx = params.length;
      accessFilter = ` AND (
        EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = t.project_id AND pr.member_id = $${idx})
        OR EXISTS (SELECT 1 FROM board_roles br JOIN boards b ON b.id = br.board_id WHERE b.project_id = t.project_id AND br.member_id = $${idx})
      )`;
    }

    const result = await query(`
      SELECT
        a.id, a.ticket_id, a.action, a.field_name, a.old_value, a.new_value, a.created_at,
        t.ticket_key, t.title AS ticket_title,
        m.display_name AS actor_name
      FROM activity_log a
      JOIN tickets_full t ON t.id = a.ticket_id
      LEFT JOIN members m ON m.id = a.member_id
      WHERE t.is_archived = false ${projectFilter} ${accessFilter}
      ORDER BY a.created_at DESC
      LIMIT $1
    `, params);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/activity error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
