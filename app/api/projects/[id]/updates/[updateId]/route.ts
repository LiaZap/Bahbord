import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';

interface Params {
  params: { id: string; updateId: string };
}

/**
 * GET /api/projects/[id]/updates/[updateId]
 * Retorna 1 update específico do projeto.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const canAccess = await hasProjectAccess(auth, params.id);
    if (!canAccess) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const result = await query(
      `SELECT
         pu.id, pu.project_id, pu.workspace_id,
         pu.period_from, pu.period_to,
         pu.ai_summary, pu.pm_notes,
         pu.generated_at, pu.generated_by_cron,
         pu.pm_completed_at, pu.pm_completed_by,
         m.display_name AS pm_completed_by_name
       FROM project_updates pu
       LEFT JOIN members m ON m.id = pu.pm_completed_by
       WHERE pu.id = $1 AND pu.project_id = $2`,
      [params.updateId, params.id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Update não encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/projects/[id]/updates/[updateId] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/updates/[updateId]
 * Body: { pm_notes }. Atualiza notas do PM e marca pm_completed_at/by.
 * Permissão: admin/owner (PMs ainda não modelados como role separada).
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado: apenas admin/owner' }, { status: 403 });
    }

    let body: { pm_notes?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    if (typeof body.pm_notes !== 'string') {
      return NextResponse.json({ error: 'pm_notes obrigatório (string)' }, { status: 400 });
    }

    const result = await query<{ id: string; workspace_id: string }>(
      `UPDATE project_updates
         SET pm_notes = $1,
             pm_completed_at = NOW(),
             pm_completed_by = $2
       WHERE id = $3 AND project_id = $4
       RETURNING id, workspace_id`,
      [body.pm_notes, auth.id, params.updateId, params.id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Update não encontrado' }, { status: 404 });
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: result.rows[0].workspace_id,
      actorId: auth.id,
      action: 'project_update.pm_updated',
      entityType: 'project_update',
      entityId: result.rows[0].id,
      changes: { pm_notes_length: body.pm_notes.length, project_id: params.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/projects/[id]/updates/[updateId] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/updates/[updateId]
 * Admin only. Audit log.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado: apenas admin/owner' }, { status: 403 });
    }

    const result = await query<{ id: string; workspace_id: string }>(
      `DELETE FROM project_updates
       WHERE id = $1 AND project_id = $2
       RETURNING id, workspace_id`,
      [params.updateId, params.id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Update não encontrado' }, { status: 404 });
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: result.rows[0].workspace_id,
      actorId: auth.id,
      action: 'project_update.deleted',
      entityType: 'project_update',
      entityId: result.rows[0].id,
      changes: { project_id: params.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id]/updates/[updateId] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
