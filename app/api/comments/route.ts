import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';
import { dispatchWebhook } from '@/lib/webhooks';
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
      `SELECT
        c.id, c.body, c.created_at, c.updated_at,
        m.display_name AS author_name, m.email AS author_email, m.avatar_url AS author_avatar
      FROM comments c
      JOIN members m ON m.id = c.author_id
      WHERE c.ticket_id = $1
      ORDER BY c.created_at ASC`,
      [ticketId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/comments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();

    const body = await request.json();
    const { ticket_id, content } = body;

    if (!ticket_id || !content?.trim()) {
      return NextResponse.json({ error: 'ticket_id e content são obrigatórios' }, { status: 400 });
    }

    // Usar membro autenticado como autor
    let memberId = auth?.id;
    if (!memberId) {
      try {
        memberId = await getDefaultMemberId();
      } catch {
        return NextResponse.json({ error: 'Nenhum membro encontrado' }, { status: 400 });
      }
    }

    const result = await query(
      `INSERT INTO comments (ticket_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [ticket_id, memberId, content.trim()]
    );

    const comment = result.rows[0];
    dispatchWebhook('comment.created', { ...comment, ticket_id });
    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    console.error('POST /api/comments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const { id, content } = body;

    if (!id || !content?.trim()) {
      return NextResponse.json({ error: 'id e content são obrigatórios' }, { status: 400 });
    }

    const result = await query(
      `UPDATE comments SET body = $1, updated_at = NOW() WHERE id = $2 RETURNING id, body, updated_at`,
      [content.trim(), id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/comments error:', err);
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

    const result = await query(`DELETE FROM comments WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/comments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
