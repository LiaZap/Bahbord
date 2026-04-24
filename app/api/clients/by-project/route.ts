import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id obrigatório' }, { status: 400 });
    }

    // Return clients that already have tickets in this project (distinct)
    const result = await query(
      `SELECT DISTINCT c.id, c.name, c.color
       FROM clients c
       INNER JOIN tickets t ON t.client_id = c.id
       WHERE t.project_id = $1 AND c.is_active = true
       ORDER BY c.name ASC`,
      [projectId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/clients/by-project error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
