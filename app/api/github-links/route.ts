import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const member = await getAuthMember();
    if (!member) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');
    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const result = await query(
      `SELECT id, type, url, title, state, number, author, created_at
       FROM github_links
       WHERE ticket_id = $1
       ORDER BY created_at DESC`,
      [ticketId]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/github-links error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
