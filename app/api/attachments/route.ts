import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';
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
      `SELECT a.id, a.file_name, a.file_url, a.file_size, a.mime_type, a.created_at,
        m.display_name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN members m ON m.id = a.uploaded_by
      WHERE a.ticket_id = $1
      ORDER BY a.created_at DESC`,
      [ticketId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/attachments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { ticket_id, file_name, file_url, file_size, mime_type } = body;

    if (!ticket_id || !file_name) {
      return NextResponse.json({ error: 'ticket_id e file_name são obrigatórios' }, { status: 400 });
    }

    let memberId: string | null = null;
    try {
      memberId = await getDefaultMemberId();
    } catch { /* sem membro padrão */ }

    const result = await query(
      `INSERT INTO attachments (ticket_id, uploaded_by, file_name, file_url, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [ticket_id, memberId, file_name, file_url || null, file_size || null, mime_type || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/attachments error:', err);
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

    await query(`DELETE FROM attachments WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/attachments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
