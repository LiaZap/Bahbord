import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const result = await query(`
      SELECT
        m.id,
        m.display_name,
        m.email,
        m.phone,
        m.avatar_url,
        m.is_approved,
        COALESCE(m.is_client, false) AS is_client,
        COALESCE(orr.role, m.role, 'member') AS role,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'project_id', p.id,
              'project_name', p.name,
              'project_color', p.color,
              'project_prefix', p.prefix,
              'role', pr.role
            ) ORDER BY p.name)
            FROM project_roles pr
            JOIN projects p ON p.id = pr.project_id
            WHERE pr.member_id = m.id AND p.is_archived = false
          ),
          '[]'::json
        ) AS projects
      FROM members m
      LEFT JOIN org_roles orr ON orr.member_id = m.id
      ORDER BY m.is_approved DESC, m.display_name ASC
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/members/with-projects error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
