import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';
import { dispatchWebhook } from '@/lib/webhooks';
import { getAuthMember } from '@/lib/api-auth';
import { createNotification, extractMentions } from '@/lib/notifications';
import { createCommentSchema, validateBody } from '@/lib/validators';

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

    const validation = await validateBody(request, createCommentSchema);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    const { ticket_id, content } = validation.data;

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

    // Notificações de @menção (fire-and-forget: falhas não quebram a resposta)
    try {
      const mentions = extractMentions(content);
      if (mentions.length > 0) {
        // Busca ticket_key + workspace_id uma única vez
        const ticketRes = await query(
          `SELECT t.workspace_id, tf.ticket_key, tf.title
           FROM tickets t
           LEFT JOIN tickets_full tf ON tf.id = t.id
           WHERE t.id = $1`,
          [ticket_id]
        );
        const ticketRow = ticketRes.rows[0];
        const ticketKey = ticketRow?.ticket_key || '';
        const ticketWorkspaceId = ticketRow?.workspace_id;

        const notified = new Set<string>();
        for (const name of mentions) {
          const memberRes = await query(
            `SELECT id, workspace_id, display_name
             FROM members
             WHERE LOWER(display_name) LIKE LOWER($1)
             ORDER BY LENGTH(display_name) ASC
             LIMIT 1`,
            [`%${name}%`]
          );
          const target = memberRes.rows[0];
          if (!target) continue;
          if (notified.has(target.id)) continue;
          notified.add(target.id);

          await createNotification({
            workspace_id: target.workspace_id || ticketWorkspaceId,
            recipient_id: target.id,
            actor_id: auth?.id,
            type: 'mention',
            entity_type: 'comment',
            entity_id: comment.id,
            title: `${auth?.display_name || 'Alguém'} mencionou você${ticketKey ? ` em ${ticketKey}` : ''}`,
            message: content.trim().substring(0, 140),
            link: `/ticket/${ticket_id}`,
          });
        }
      }
    } catch (notifyErr) {
      console.error('Erro ao processar menções do comentário:', notifyErr);
    }

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
