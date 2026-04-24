import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { dispatchWebhook } from '@/lib/webhooks';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { createNotification } from '@/lib/notifications';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await getAuthMember();

    const result = await query(
      `SELECT
        tf.id, tf.workspace_id, tf.title, tf.description, tf.priority,
        tf.due_date, tf.sequence_number, tf.created_at, tf.updated_at,
        tf.completed_at, tf.is_archived, tf.parent_id, tf.ticket_key,
        tf.type_id, tf.type_name, tf.type_icon, tf.type_color,
        tf.status_id, tf.status_name, tf.status_color, tf.status_position, tf.is_done,
        tf.service_id, tf.service_name, tf.service_color,
        tf.category_id, tf.category_name,
        tf.client_id, tf.client_name, tf.client_color,
        tf.assignee_id, tf.assignee_name,
        tf.reporter_id, tf.reporter_name,
        tf.sprint_name,
        tf.subtask_count, tf.subtask_done_count, tf.comment_count,
        t.ticket_type_id, t.sprint_id, t.board_id, t.project_id,
        COALESCE((
          SELECT SUM(te.duration_minutes)
          FROM time_entries te
          WHERE te.ticket_id = t.id AND te.is_running = false
        ), 0)::int AS total_time_minutes,
        CASE WHEN t.parent_id IS NOT NULL THEN
          (SELECT w2.prefix || '-' || LPAD(p.sequence_number::text, 3, '0')
           FROM tickets p JOIN workspaces w2 ON w2.id = p.workspace_id
           WHERE p.id = t.parent_id)
        ELSE NULL END AS parent_key,
        CASE WHEN t.parent_id IS NOT NULL THEN
          (SELECT p.title FROM tickets p WHERE p.id = t.parent_id)
        ELSE NULL END AS parent_title
      FROM tickets_full tf
      JOIN tickets t ON t.id = tf.id
      WHERE tf.id = $1`,
      [params.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
  const auth = await getAuthMember();

  const body = await request.json();
  const ticketId = params.id;
  const expectedUpdatedAt = body._updated_at; // OCC: versão esperada

  // Capturar assignee anterior para detectar mudança e evitar notificação duplicada
  let previousAssigneeId: string | null = null;
  if ('assignee_id' in body) {
    const prevRes = await query(
      `SELECT assignee_id FROM tickets WHERE id = $1`,
      [ticketId]
    );
    previousAssigneeId = prevRes.rows[0]?.assignee_id ?? null;
  }

  const allowedFields: Record<string, string> = {
    title: 'title',
    description: 'description',
    priority: 'priority',
    due_date: 'due_date',
    status_id: 'status_id',
    assignee_id: 'assignee_id',
    reporter_id: 'reporter_id',
    service_id: 'service_id',
    category_id: 'category_id',
    sprint_id: 'sprint_id',
    ticket_type_id: 'ticket_type_id',
    parent_id: 'parent_id',
    client_id: 'client_id',
    project_id: 'project_id',
    board_id: 'board_id',
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, col] of Object.entries(allowedFields)) {
    if (key in body) {
      sets.push(`${col} = $${idx}`);
      values.push(body[key]);
      idx++;
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  sets.push(`updated_at = NOW()`);
  values.push(ticketId);

  const result = await query(
    `UPDATE tickets SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
  }

  const ticket = result.rows[0];
  dispatchWebhook('ticket.updated', ticket);

  // Notificar nova atribuição se assignee_id mudou para alguém diferente do ator
  if (
    'assignee_id' in body &&
    ticket.assignee_id &&
    ticket.assignee_id !== previousAssigneeId &&
    ticket.assignee_id !== auth?.id
  ) {
    try {
      const keyRes = await query(
        `SELECT ticket_key FROM tickets_full WHERE id = $1`,
        [ticket.id]
      );
      const ticketKey = keyRes.rows[0]?.ticket_key || '';
      await createNotification({
        workspace_id: ticket.workspace_id,
        recipient_id: ticket.assignee_id,
        actor_id: auth?.id,
        type: 'assigned',
        entity_type: 'ticket',
        entity_id: ticket.id,
        title: `Você foi atribuído ao ticket${ticketKey ? ` ${ticketKey}` : ''}`,
        message: ticket.title,
        link: `/ticket/${ticket.id}`,
      });
    } catch (notifyErr) {
      console.error('Erro ao notificar atribuição na atualização do ticket:', notifyErr);
    }
  }

  return NextResponse.json(ticket);
  } catch (err) {
    console.error('PATCH /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Apenas administradores podem excluir tickets' }, { status: 403 });
    }

    const result = await query(`DELETE FROM tickets WHERE id = $1 RETURNING id`, [params.id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tickets/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
