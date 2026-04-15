import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const queries: Record<string, string> = {
      statuses: `SELECT id, name, color FROM statuses ORDER BY position ASC`,
      services: `SELECT id, name, color FROM services WHERE is_active = true ORDER BY name ASC`,
      members: `SELECT m.id, m.display_name, m.email, m.phone, m.avatar_url, COALESCE(orr.role, m.role, 'member') AS role FROM members m LEFT JOIN org_roles orr ON orr.member_id = m.id ORDER BY m.display_name ASC`,
      categories: `SELECT id, name, color FROM categories ORDER BY name ASC`,
      sprints: `SELECT id, name, is_active FROM sprints ORDER BY created_at DESC`,
      ticket_types: `SELECT id, name, icon, color FROM ticket_types ORDER BY position ASC`,
      clients: `SELECT id, name, color FROM clients WHERE is_active = true ORDER BY name ASC`,
      projects: `SELECT id, name, prefix, color FROM projects WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1) AND is_archived = false ORDER BY name ASC`,
      boards: `SELECT id, name, type, project_id FROM boards ORDER BY name ASC`,
      templates: `SELECT id, name, description FROM project_templates ORDER BY name ASC`,
    };

    if (!type || !queries[type]) {
      return NextResponse.json({ error: 'type inválido. Use: statuses, services, members, categories, sprints, ticket_types, clients, projects, boards, templates' }, { status: 400 });
    }

    const result = await query(queries[type]);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/options error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
