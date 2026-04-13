import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await query(
    `SELECT
      id, title, description, priority, ticket_key, due_date,
      type_name, type_icon, type_color, ticket_type_id,
      status_id, status_name, status_color,
      service_id, service_name, service_color,
      assignee_id, assignee_name,
      reporter_id, reporter_name,
      category_id, category_name,
      sprint_id, sprint_name,
      parent_id, parent_key, parent_title,
      subtask_count, subtask_done_count, comment_count, total_time_minutes,
      created_at, updated_at, completed_at
    FROM tickets_full
    WHERE id = $1`,
    [params.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const ticketId = params.id;

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

  return NextResponse.json(result.rows[0]);
}
