import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const result = await query(
      `SELECT id, ticket_id, type, title, url, status, provider, created_at
       FROM dev_links
       WHERE ticket_id = $1
       ORDER BY type, created_at DESC`,
      [ticketId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/dev-links error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { ticket_id, type, title, url, status, provider } = body;

    if (!ticket_id || !type || !title) {
      return NextResponse.json({ error: 'ticket_id, type e title são obrigatórios' }, { status: 400 });
    }

    const validTypes = ['branch', 'pull_request', 'commit'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'type inválido' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO dev_links (ticket_id, type, title, url, status, provider)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [ticket_id, type, title, url || null, status || null, provider || 'github']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/dev-links error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    await query(`DELETE FROM dev_links WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/dev-links error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
