import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { query } from '@/lib/db';
import { comments } from '@/lib/schema/social';
import { members } from '@/lib/schema/core';
import { eq, and, asc } from 'drizzle-orm';
import { dispatchWebhook } from '@/lib/webhooks';
import { getAuthMember } from '@/lib/api-auth';
import { hasTicketAccess } from '@/lib/access-check';
import { createNotification, extractMentions } from '@/lib/notifications';
import { createCommentSchema, validateBody } from '@/lib/validators';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });
    }

    const canAccess = await hasTicketAccess(auth, ticketId);
    if (!canAccess) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const rows = await db.select({
      id: comments.id,
      body: comments.body,
      created_at: comments.createdAt,
      updated_at: comments.updatedAt,
      author_id: comments.authorId,
      author_name: members.displayName,
      author_email: members.email,
      author_avatar: members.avatarUrl,
    })
      .from(comments)
      .innerJoin(members, eq(members.id, comments.authorId))
      .where(eq(comments.ticketId, ticketId))
      .orderBy(asc(comments.createdAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/comments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const validation = await validateBody(request, createCommentSchema);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    const { ticket_id, content } = validation.data;

    const [comment] = await db.insert(comments).values({
      ticketId: ticket_id,
      authorId: auth.id,
      body: content.trim(),
    }).returning();

    dispatchWebhook('comment.created', { ...comment, ticket_id });

    // Notificações de @menção (fire-and-forget)
    try {
      const mentions = extractMentions(content);
      if (mentions.length > 0) {
        const ticketRes = await query(
          `SELECT t.workspace_id, tf.ticket_key, tf.title
           FROM tickets t LEFT JOIN tickets_full tf ON tf.id = t.id WHERE t.id = $1`,
          [ticket_id]
        );
        const ticketRow = ticketRes.rows[0];
        const ticketKey = ticketRow?.ticket_key || '';
        const ticketWorkspaceId = ticketRow?.workspace_id;

        const notified = new Set<string>();
        for (const name of mentions) {
          const [target] = await db.select({ id: members.id, workspaceId: members.workspaceId, displayName: members.displayName })
            .from(members)
            .where(eq(members.displayName, name))
            .limit(1);
          if (!target || notified.has(target.id)) continue;
          notified.add(target.id);

          await createNotification({
            workspace_id: target.workspaceId || ticketWorkspaceId,
            recipient_id: target.id,
            actor_id: auth.id,
            type: 'mention',
            entity_type: 'comment',
            entity_id: comment.id,
            title: `${auth.display_name || 'Alguém'} mencionou você${ticketKey ? ` em ${ticketKey}` : ''}`,
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
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const { id, content } = body;

    if (!id || !content?.trim()) {
      return NextResponse.json({ error: 'id e content são obrigatórios' }, { status: 400 });
    }

    const isAdminUser = auth.role === 'owner' || auth.role === 'admin';

    // Author OR admin pode editar
    const condition = isAdminUser
      ? eq(comments.id, id)
      : and(eq(comments.id, id), eq(comments.authorId, auth.id));

    const [updated] = await db.update(comments)
      .set({ body: content.trim(), updatedAt: new Date() })
      .where(condition!)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Sem permissão ou comentário não encontrado' }, { status: 403 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/comments error:', err);
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

    const isAdminUser = auth.role === 'owner' || auth.role === 'admin';
    const condition = isAdminUser
      ? eq(comments.id, id)
      : and(eq(comments.id, id), eq(comments.authorId, auth.id));

    const deleted = await db.delete(comments).where(condition!).returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Sem permissão ou comentário não encontrado' }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/comments error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
