import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

/**
 * Verifica se o auth pode mutar a initiative (admin OU owner).
 */
async function canMutate(authId: string, authRole: string, initiativeId: string): Promise<boolean> {
  if (isAdmin(authRole)) return true;
  const ownerCheck = await query(
    `SELECT 1 FROM initiatives WHERE id = $1 AND owner_id = $2`,
    [initiativeId, authId],
  );
  return (ownerCheck.rowCount ?? 0) > 0;
}

/**
 * POST /api/initiatives/[id]/projects
 * Body: { project_id, weight? }
 * Adiciona um project à initiative. Idempotente via ON CONFLICT — repetir o
 * mesmo project apenas atualiza o weight.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const allowed = await canMutate(auth.id, auth.role, params.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let body: { project_id?: string; weight?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const projectId = body.project_id;
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'project_id obrigatório' }, { status: 400 });
    }

    const weightRaw = body.weight;
    const weight =
      typeof weightRaw === 'number' && Number.isFinite(weightRaw) && weightRaw > 0
        ? Math.floor(weightRaw)
        : 1;

    // Carrega initiative pra obter workspace e validar que project pertence
    // ao mesmo workspace.
    const initRes = await query<{ workspace_id: string }>(
      `SELECT workspace_id FROM initiatives WHERE id = $1`,
      [params.id],
    );
    if (!initRes.rows[0]) {
      return NextResponse.json({ error: 'Initiative não encontrada' }, { status: 404 });
    }
    const workspaceId = initRes.rows[0].workspace_id;

    const projCheck = await query(
      `SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2`,
      [projectId, workspaceId],
    );
    if (!projCheck.rows[0]) {
      return NextResponse.json(
        { error: 'project_id inválido para este workspace' },
        { status: 400 },
      );
    }

    const upserted = await query(
      `INSERT INTO initiative_projects (initiative_id, project_id, weight, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (initiative_id, project_id)
       DO UPDATE SET weight = EXCLUDED.weight
       RETURNING initiative_id, project_id, weight, added_at`,
      [params.id, projectId, weight, auth.id],
    );

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: auth.id,
      action: 'initiative.project_added',
      entityType: 'initiative',
      entityId: params.id,
      changes: { project_id: projectId, weight },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(upserted.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/initiatives/[id]/projects error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
