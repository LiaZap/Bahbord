import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

const ALLOWED_EVENTS = new Set([
  'ticket.created',
  'ticket.status_changed',
  'ticket.assigned',
]);

const ALLOWED_ACTIONS = new Set([
  'assign_to',
  'add_comment',
  'set_priority',
  'notify_member',
]);

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const workspaceId = auth.workspace_id;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    const params: unknown[] = [workspaceId];
    let whereProject = '';
    if (projectId) {
      params.push(projectId);
      whereProject = ` AND (a.project_id = $${params.length} OR a.project_id IS NULL)`;
    }

    const result = await query(
      `SELECT a.id, a.workspace_id, a.project_id, a.name, a.description,
              a.is_active, a.trigger_event, a.trigger_conditions,
              a.action_type, a.action_params,
              a.created_at, a.updated_at, a.created_by,
              p.name AS project_name
       FROM automations a
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.workspace_id = $1${whereProject}
       ORDER BY a.created_at DESC`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/automations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      project_id,
      is_active,
      trigger_event,
      trigger_conditions,
      action_type,
      action_params,
    } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }
    if (!trigger_event || !ALLOWED_EVENTS.has(trigger_event)) {
      return NextResponse.json({ error: 'trigger_event inválido' }, { status: 400 });
    }
    if (!action_type || !ALLOWED_ACTIONS.has(action_type)) {
      return NextResponse.json({ error: 'action_type inválido' }, { status: 400 });
    }

    const workspaceId = auth.workspace_id;

    const result = await query(
      `INSERT INTO automations (
        workspace_id, project_id, name, description, is_active,
        trigger_event, trigger_conditions, action_type, action_params, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        workspaceId,
        project_id || null,
        name.trim(),
        description || null,
        is_active === false ? false : true,
        trigger_event,
        JSON.stringify(trigger_conditions || {}),
        action_type,
        JSON.stringify(action_params || {}),
        auth.id,
      ]
    );

    const created = result.rows[0] as { id: string; name: string; trigger_event: string; action_type: string; project_id: string | null };
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: auth.id,
      action: 'automation.created',
      entityType: 'automation',
      entityId: created.id,
      changes: {
        name: created.name,
        trigger_event: created.trigger_event,
        action_type: created.action_type,
        project_id: created.project_id,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/automations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(body.name);
    }
    if (body.description !== undefined) {
      sets.push(`description = $${idx++}`);
      values.push(body.description || null);
    }
    if (body.project_id !== undefined) {
      sets.push(`project_id = $${idx++}`);
      values.push(body.project_id || null);
    }
    if (body.is_active !== undefined) {
      sets.push(`is_active = $${idx++}`);
      values.push(!!body.is_active);
    }
    if (body.trigger_event !== undefined) {
      if (!ALLOWED_EVENTS.has(body.trigger_event)) {
        return NextResponse.json({ error: 'trigger_event inválido' }, { status: 400 });
      }
      sets.push(`trigger_event = $${idx++}`);
      values.push(body.trigger_event);
    }
    if (body.trigger_conditions !== undefined) {
      sets.push(`trigger_conditions = $${idx++}`);
      values.push(JSON.stringify(body.trigger_conditions || {}));
    }
    if (body.action_type !== undefined) {
      if (!ALLOWED_ACTIONS.has(body.action_type)) {
        return NextResponse.json({ error: 'action_type inválido' }, { status: 400 });
      }
      sets.push(`action_type = $${idx++}`);
      values.push(body.action_type);
    }
    if (body.action_params !== undefined) {
      sets.push(`action_params = $${idx++}`);
      values.push(JSON.stringify(body.action_params || {}));
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE automations SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 });
    }

    const updated = result.rows[0] as { id: string; workspace_id: string };
    const meta = extractRequestMeta(request);
    const changedKeys = Object.keys(body).filter((k) => k !== 'id');
    await logAudit({
      workspaceId: updated.workspace_id,
      actorId: auth.id,
      action: 'automation.updated',
      entityType: 'automation',
      entityId: updated.id,
      changes: { fields: changedKeys, is_active: body.is_active },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/automations error:', err);
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
      `DELETE FROM automations WHERE id = $1 RETURNING id, workspace_id, name`,
      [id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 });
    }

    const deleted = result.rows[0];
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: deleted.workspace_id,
      actorId: auth.id,
      action: 'automation.deleted',
      entityType: 'automation',
      entityId: deleted.id,
      changes: { name: deleted.name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/automations error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
