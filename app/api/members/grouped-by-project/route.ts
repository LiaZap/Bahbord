import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Get all projects + members that have access to each
    const result = await query(`
      SELECT
        p.id AS project_id, p.name AS project_name, p.color AS project_color, p.prefix AS project_prefix,
        m.id AS member_id, m.display_name, m.email, m.phone, m.avatar_url,
        COALESCE(m.is_client, false) AS is_client,
        COALESCE(orr.role, m.role, 'member') AS org_role,
        COALESCE(pr.role, br.role) AS project_role,
        br.board_id,
        b.name AS board_name
      FROM projects p
      LEFT JOIN project_roles pr ON pr.project_id = p.id
      LEFT JOIN board_roles br ON br.board_id IN (SELECT id FROM boards WHERE project_id = p.id)
      LEFT JOIN boards b ON b.id = br.board_id
      LEFT JOIN members m ON m.id = COALESCE(pr.member_id, br.member_id)
      LEFT JOIN org_roles orr ON orr.member_id = m.id AND orr.workspace_id = m.workspace_id
      WHERE p.is_archived = false AND m.id IS NOT NULL
      ORDER BY p.name, m.display_name
    `);

    // Also get members without any project (admins/unassigned)
    const unassigned = await query(`
      SELECT m.id, m.display_name, m.email, m.phone, m.avatar_url,
             COALESCE(orr.role, m.role, 'member') AS org_role
      FROM members m
      LEFT JOIN org_roles orr ON orr.member_id = m.id
      WHERE NOT EXISTS (
        SELECT 1 FROM project_roles pr WHERE pr.member_id = m.id
      ) AND NOT EXISTS (
        SELECT 1 FROM board_roles br WHERE br.member_id = m.id
      )
      ORDER BY m.display_name
    `);

    // Group by project
    const grouped: Record<string, any> = {};
    for (const row of result.rows) {
      const key = row.project_id;
      if (!grouped[key]) {
        grouped[key] = {
          project_id: row.project_id,
          project_name: row.project_name,
          project_color: row.project_color,
          project_prefix: row.project_prefix,
          members: []
        };
      }
      // Avoid duplicates
      if (!grouped[key].members.find((m: any) => m.id === row.member_id)) {
        grouped[key].members.push({
          id: row.member_id,
          display_name: row.display_name,
          email: row.email,
          phone: row.phone,
          avatar_url: row.avatar_url,
          role: row.org_role,
          project_role: row.project_role,
          board_name: row.board_name,
        });
      }
    }

    return NextResponse.json({
      projects: Object.values(grouped),
      unassigned: unassigned.rows,
    });
  } catch (err) {
    console.error('GET /api/members/grouped-by-project error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
