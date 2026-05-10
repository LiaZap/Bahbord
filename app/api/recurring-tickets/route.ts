import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { computeNextRunAt } from '@/lib/recurring';

const ALLOWED_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low']);

interface RecurringBody {
  id?: string;
  project_id?: string | null;
  board_id?: string | null;
  name?: string;
  title_template?: string;
  description_html?: string | null;
  ticket_type_id?: string | null;
  service_id?: string | null;
  assignee_id?: string | null;
  priority?: string | null;
  cron_expression?: string;
  is_active?: boolean;
}

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const workspaceId = auth.workspace_id;

    const result = await query(
      `SELECT r.id, r.workspace_id, r.project_id, r.board_id, r.name,
              r.title_template, r.description_html, r.ticket_type_id,
              r.service_id, r.assignee_id, r.priority, r.cron_expression,
              r.is_active, r.last_run_at, r.next_run_at,
              r.created_at, r.created_by,
              p.name AS project_name,
              b.name AS board_name,
              tt.name AS ticket_type_name,
              sv.name AS service_name,
              m.display_name AS assignee_name
       FROM recurring_tickets r
       LEFT JOIN projects p ON p.id = r.project_id
       LEFT JOIN boards b ON b.id = r.board_id
       LEFT JOIN ticket_types tt ON tt.id = r.ticket_type_id
       LEFT JOIN services sv ON sv.id = r.service_id
       LEFT JOIN members m ON m.id = r.assignee_id
       WHERE r.workspace_id = $1
       ORDER BY r.created_at DESC`,
      [workspaceId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/recurring-tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = (await request.json()) as RecurringBody;

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }
    if (!body.title_template || !body.title_template.trim()) {
      return NextResponse.json({ error: 'title_template é obrigatório' }, { status: 400 });
    }
    if (!body.cron_expression || !body.cron_expression.trim()) {
      return NextResponse.json({ error: 'cron_expression é obrigatório' }, { status: 400 });
    }
    if (body.priority && !ALLOWED_PRIORITIES.has(body.priority)) {
      return NextResponse.json({ error: 'priority inválido' }, { status: 400 });
    }

    let nextRunAt: Date;
    try {
      nextRunAt = computeNextRunAt(body.cron_expression.trim(), new Date());
    } catch (err) {
      return NextResponse.json(
        { error: `cron_expression inválida: ${(err as Error).message}` },
        { status: 400 }
      );
    }

    const workspaceId = auth.workspace_id;

    const result = await query(
      `INSERT INTO recurring_tickets (
        workspace_id, project_id, board_id, name, title_template,
        description_html, ticket_type_id, service_id, assignee_id, priority,
        cron_expression, is_active, next_run_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        workspaceId,
        body.project_id || null,
        body.board_id || null,
        body.name.trim(),
        body.title_template.trim(),
        body.description_html || null,
        body.ticket_type_id || null,
        body.service_id || null,
        body.assignee_id || null,
        body.priority || 'medium',
        body.cron_expression.trim(),
        body.is_active === false ? false : true,
        nextRunAt,
        auth.id,
      ]
    );

    const created = result.rows[0] as { id: string; name: string; cron_expression: string };
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: auth.id,
      action: 'recurring_ticket.created',
      entityType: 'recurring_ticket',
      entityId: created.id,
      changes: { name: created.name, cron: created.cron_expression },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/recurring-tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = (await request.json()) as RecurringBody;
    if (!body.id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: 'name não pode ser vazio' }, { status: 400 });
      }
      sets.push(`name = $${idx++}`);
      values.push(body.name.trim());
    }
    if (body.project_id !== undefined) {
      sets.push(`project_id = $${idx++}`);
      values.push(body.project_id || null);
    }
    if (body.board_id !== undefined) {
      sets.push(`board_id = $${idx++}`);
      values.push(body.board_id || null);
    }
    if (body.title_template !== undefined) {
      if (!body.title_template.trim()) {
        return NextResponse.json({ error: 'title_template não pode ser vazio' }, { status: 400 });
      }
      sets.push(`title_template = $${idx++}`);
      values.push(body.title_template.trim());
    }
    if (body.description_html !== undefined) {
      sets.push(`description_html = $${idx++}`);
      values.push(body.description_html || null);
    }
    if (body.ticket_type_id !== undefined) {
      sets.push(`ticket_type_id = $${idx++}`);
      values.push(body.ticket_type_id || null);
    }
    if (body.service_id !== undefined) {
      sets.push(`service_id = $${idx++}`);
      values.push(body.service_id || null);
    }
    if (body.assignee_id !== undefined) {
      sets.push(`assignee_id = $${idx++}`);
      values.push(body.assignee_id || null);
    }
    if (body.priority !== undefined) {
      if (body.priority && !ALLOWED_PRIORITIES.has(body.priority)) {
        return NextResponse.json({ error: 'priority inválido' }, { status: 400 });
      }
      sets.push(`priority = $${idx++}`);
      values.push(body.priority || 'medium');
    }
    if (body.cron_expression !== undefined) {
      if (!body.cron_expression.trim()) {
        return NextResponse.json({ error: 'cron_expression não pode ser vazio' }, { status: 400 });
      }
      let nextRunAt: Date;
      try {
        nextRunAt = computeNextRunAt(body.cron_expression.trim(), new Date());
      } catch (err) {
        return NextResponse.json(
          { error: `cron_expression inválida: ${(err as Error).message}` },
          { status: 400 }
        );
      }
      sets.push(`cron_expression = $${idx++}`);
      values.push(body.cron_expression.trim());
      sets.push(`next_run_at = $${idx++}`);
      values.push(nextRunAt);
    }
    if (body.is_active !== undefined) {
      sets.push(`is_active = $${idx++}`);
      values.push(!!body.is_active);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(body.id);

    const result = await query(
      `UPDATE recurring_tickets SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Recurring ticket não encontrado' }, { status: 404 });
    }

    const updated = result.rows[0] as { id: string; workspace_id: string };
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: updated.workspace_id,
      actorId: auth.id,
      action: 'recurring_ticket.updated',
      entityType: 'recurring_ticket',
      entityId: updated.id,
      changes: { fields: Object.keys(body).filter((k) => k !== 'id'), is_active: body.is_active },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/recurring-tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query<{ id: string; workspace_id: string; name: string }>(
      `DELETE FROM recurring_tickets WHERE id = $1 RETURNING id, workspace_id, name`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Recurring ticket não encontrado' }, { status: 404 });
    }

    const deleted = result.rows[0];
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: deleted.workspace_id,
      actorId: auth.id,
      action: 'recurring_ticket.deleted',
      entityType: 'recurring_ticket',
      entityId: deleted.id,
      changes: { name: deleted.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/recurring-tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
