import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

const ALLOWED_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low']);

interface TemplateBody {
  id?: string;
  name?: string;
  ticket_type_id?: string | null;
  title_template?: string | null;
  description_html?: string | null;
  priority?: string | null;
  service_id?: string | null;
  category_id?: string | null;
  subtasks?: string[];
}

function normalizeSubtasks(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);
}

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const workspaceId = auth.workspace_id;

    const result = await query(
      `SELECT t.id, t.workspace_id, t.name, t.ticket_type_id, t.title_template,
              t.description_html, t.priority, t.service_id, t.category_id,
              t.subtasks, t.created_at, t.created_by,
              tt.name AS ticket_type_name,
              sv.name AS service_name,
              c.name AS category_name
       FROM ticket_templates t
       LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
       LEFT JOIN services sv ON sv.id = t.service_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.workspace_id = $1
       ORDER BY t.name ASC`,
      [workspaceId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/ticket-templates error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = (await request.json()) as TemplateBody;

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }
    if (body.priority && !ALLOWED_PRIORITIES.has(body.priority)) {
      return NextResponse.json({ error: 'priority inválido' }, { status: 400 });
    }

    const workspaceId = auth.workspace_id;
    const subtasks = normalizeSubtasks(body.subtasks);

    const result = await query(
      `INSERT INTO ticket_templates (
        workspace_id, name, ticket_type_id, title_template, description_html,
        priority, service_id, category_id, subtasks, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        workspaceId,
        body.name.trim(),
        body.ticket_type_id || null,
        body.title_template || null,
        body.description_html || null,
        body.priority || null,
        body.service_id || null,
        body.category_id || null,
        JSON.stringify(subtasks),
        auth.id,
      ]
    );

    const created = result.rows[0] as { id: string; name: string };
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: auth.id,
      action: 'ticket_template.created',
      entityType: 'ticket_template',
      entityId: created.id,
      changes: { name: created.name, subtasks_count: subtasks.length },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/ticket-templates error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = (await request.json()) as TemplateBody;
    if (!body.id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      if (!body.name || !body.name.trim()) {
        return NextResponse.json({ error: 'name não pode ser vazio' }, { status: 400 });
      }
      sets.push(`name = $${idx++}`);
      values.push(body.name.trim());
    }
    if (body.ticket_type_id !== undefined) {
      sets.push(`ticket_type_id = $${idx++}`);
      values.push(body.ticket_type_id || null);
    }
    if (body.title_template !== undefined) {
      sets.push(`title_template = $${idx++}`);
      values.push(body.title_template || null);
    }
    if (body.description_html !== undefined) {
      sets.push(`description_html = $${idx++}`);
      values.push(body.description_html || null);
    }
    if (body.priority !== undefined) {
      if (body.priority && !ALLOWED_PRIORITIES.has(body.priority)) {
        return NextResponse.json({ error: 'priority inválido' }, { status: 400 });
      }
      sets.push(`priority = $${idx++}`);
      values.push(body.priority || null);
    }
    if (body.service_id !== undefined) {
      sets.push(`service_id = $${idx++}`);
      values.push(body.service_id || null);
    }
    if (body.category_id !== undefined) {
      sets.push(`category_id = $${idx++}`);
      values.push(body.category_id || null);
    }
    if (body.subtasks !== undefined) {
      sets.push(`subtasks = $${idx++}`);
      values.push(JSON.stringify(normalizeSubtasks(body.subtasks)));
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(body.id);

    const result = await query(
      `UPDATE ticket_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    const updated = result.rows[0] as { id: string; workspace_id: string };
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: updated.workspace_id,
      actorId: auth.id,
      action: 'ticket_template.updated',
      entityType: 'ticket_template',
      entityId: updated.id,
      changes: { fields: Object.keys(body).filter((k) => k !== 'id') },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/ticket-templates error:', err);
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
      `DELETE FROM ticket_templates WHERE id = $1 RETURNING id, workspace_id, name`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    const deleted = result.rows[0];
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: deleted.workspace_id,
      actorId: auth.id,
      action: 'ticket_template.deleted',
      entityType: 'ticket_template',
      entityId: deleted.id,
      changes: { name: deleted.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/ticket-templates error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
