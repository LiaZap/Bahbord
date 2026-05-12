import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticketId);
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
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
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { ticket_id, file_name, file_url, file_size, mime_type } = body;

    if (!ticket_id || !file_name) {
      return NextResponse.json({ error: 'ticket_id e file_name são obrigatórios' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticket_id);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const memberId = auth.id;

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
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    // Resolve ticket_id do attachment para validar acesso
    const attRes = await query<{ ticket_id: string }>(
      `SELECT ticket_id FROM attachments WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!attRes.rows[0]) {
      return NextResponse.json({ error: 'Anexo não encontrado' }, { status: 404 });
    }
    const allowed = await hasTicketAccess(auth, attRes.rows[0].ticket_id);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    await query(`DELETE FROM attachments WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/attachments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
