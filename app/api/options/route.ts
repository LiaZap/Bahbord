import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // members é acessível a todos os autenticados, mas projeção depende do role:
    // admin/owner vê email/phone; outros veem só id/name/avatar/role
    const isAdminUser = isAdmin(auth.role);

    const projectId = searchParams.get('project_id');

    const membersAdminSql = `SELECT m.id, m.display_name, m.email, m.phone, m.avatar_url, COALESCE(orr.role, m.role, 'member') AS role FROM members m LEFT JOIN org_roles orr ON orr.member_id = m.id ORDER BY m.display_name ASC`;
    const membersBasicSql = `SELECT m.id, m.display_name, m.avatar_url, COALESCE(orr.role, m.role, 'member') AS role FROM members m LEFT JOIN org_roles orr ON orr.member_id = m.id WHERE COALESCE(m.is_approved, true) = true ORDER BY m.display_name ASC`;

    const queries: Record<string, { sql: string; params?: unknown[] }> = {
      statuses: { sql: `SELECT id, name, color, is_done FROM statuses ORDER BY position ASC` },
      services: { sql: `SELECT id, name, color FROM services WHERE is_active = true ORDER BY name ASC` },
      members: { sql: isAdminUser ? membersAdminSql : membersBasicSql },
      categories: { sql: `SELECT id, name, color FROM categories ORDER BY name ASC` },
      sprints: projectId
        ? { sql: `SELECT id, name, is_active FROM sprints WHERE project_id = $1 ORDER BY is_active DESC, created_at DESC`, params: [projectId] }
        : { sql: `SELECT id, name, is_active FROM sprints ORDER BY created_at DESC` },
      ticket_types: { sql: `SELECT id, name, icon, color FROM ticket_types ORDER BY position ASC` },
      clients: { sql: `SELECT id, name, color FROM clients WHERE is_active = true ORDER BY name ASC` },
      projects: { sql: `SELECT id, name, prefix, color FROM projects WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1) AND is_archived = false ORDER BY name ASC` },
      boards: { sql: `SELECT id, name, type, project_id FROM boards ORDER BY name ASC` },
      templates: { sql: `SELECT id, name, description FROM project_templates ORDER BY name ASC` },
    };

    if (!type || !queries[type]) {
      return NextResponse.json({ error: 'type inválido. Use: statuses, services, members, categories, sprints, ticket_types, clients, projects, boards, templates' }, { status: 400 });
    }

    const q = queries[type];
    const result = await query(q.sql, q.params as Array<unknown> | undefined);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/options error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
