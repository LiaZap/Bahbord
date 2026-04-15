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
      `SELECT id, ticket_id, label, url, type, created_at
       FROM access_links
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticketId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/access-links error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { ticket_id, label, url, type } = body;

    if (!ticket_id || !label?.trim() || !url?.trim()) {
      return NextResponse.json({ error: 'ticket_id, label e url são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO access_links (ticket_id, label, url, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticket_id, label.trim(), url.trim(), type || 'link']
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/access-links error:', err);
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

    await query(`DELETE FROM access_links WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/access-links error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
