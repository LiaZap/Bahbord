import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

async function canMutate(authId: string, authRole: string, initiativeId: string): Promise<boolean> {
  if (isAdmin(authRole)) return true;
  const ownerCheck = await query(
    `SELECT 1 FROM initiatives WHERE id = $1 AND owner_id = $2`,
    [initiativeId, authId],
  );
  return (ownerCheck.rowCount ?? 0) > 0;
}

/**
 * DELETE /api/initiatives/[id]/projects/[project_id]
 * Remove o vínculo entre initiative e project. Não deleta o project em si.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; project_id: string } },
) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const allowed = await canMutate(auth.id, auth.role, params.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const initRes = await query<{ workspace_id: string }>(
      `SELECT workspace_id FROM initiatives WHERE id = $1`,
      [params.id],
    );
    if (!initRes.rows[0]) {
      return NextResponse.json({ error: 'Initiative não encontrada' }, { status: 404 });
    }

    const removed = await query(
      `DELETE FROM initiative_projects
       WHERE initiative_id = $1 AND project_id = $2
       RETURNING project_id`,
      [params.id, params.project_id],
    );

    if (removed.rowCount === 0) {
      return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 });
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: initRes.rows[0].workspace_id,
      actorId: auth.id,
      action: 'initiative.project_removed',
      entityType: 'initiative',
      entityId: params.id,
      changes: { project_id: params.project_id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/initiatives/[id]/projects/[project_id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
