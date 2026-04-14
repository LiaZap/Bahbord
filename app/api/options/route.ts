import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const queries: Record<string, string> = {
      statuses: `SELECT id, name, color FROM statuses ORDER BY position ASC`,
      services: `SELECT id, name, color FROM services WHERE is_active = true ORDER BY name ASC`,
      members: `SELECT id, display_name, avatar_url, email FROM members ORDER BY display_name ASC`,
      categories: `SELECT id, name, color FROM categories ORDER BY name ASC`,
      sprints: `SELECT id, name, is_active FROM sprints ORDER BY created_at DESC`,
      ticket_types: `SELECT id, name, icon, color FROM ticket_types ORDER BY position ASC`,
    };

    if (!type || !queries[type]) {
      return NextResponse.json({ error: 'type inválido. Use: statuses, services, members, categories, sprints, ticket_types' }, { status: 400 });
    }

    const result = await query(queries[type]);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/options error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
