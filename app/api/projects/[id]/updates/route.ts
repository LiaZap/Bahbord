import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import {
  generateAndSaveUpdateForProject,
  lastWeekWindow,
} from '@/lib/project-updates';

/**
 * GET /api/projects/[id]/updates
 * Lista todos os updates do projeto, mais recentes primeiro.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
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
       WHERE pu.project_id = $1
       ORDER BY pu.period_to DESC, pu.generated_at DESC`,
      [params.id]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/projects/[id]/updates error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/updates
 * Cria um novo update gerando IA. Body: { period_from?, period_to? }.
 * Defaults: última semana (now - 7d → now).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const canAccess = await hasProjectAccess(auth, params.id);
    if (!canAccess) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let body: { period_from?: string; period_to?: string } = {};
    try {
      body = await request.json();
    } catch {
      // body vazio é ok — usa defaults
    }

    const defaultWin = lastWeekWindow();
    const periodFrom = body.period_from ? new Date(body.period_from) : defaultWin.from;
    const periodTo = body.period_to ? new Date(body.period_to) : defaultWin.to;

    if (isNaN(periodFrom.getTime()) || isNaN(periodTo.getTime())) {
      return NextResponse.json({ error: 'period_from/period_to inválidos' }, { status: 400 });
    }
    if (periodFrom >= periodTo) {
      return NextResponse.json({ error: 'period_from deve ser anterior a period_to' }, { status: 400 });
    }

    const saved = await generateAndSaveUpdateForProject(
      params.id,
      periodFrom,
      periodTo,
      false /* generated_by_cron = false (manual) */
    );

    if (!saved) {
      return NextResponse.json({ error: 'Projeto não encontrado ou arquivado' }, { status: 404 });
    }

    // Buscar projeto para audit
    const proj = await query<{ workspace_id: string }>(
      `SELECT workspace_id FROM projects WHERE id = $1`,
      [params.id]
    );
    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: proj.rows[0]?.workspace_id ?? null,
      actorId: auth.id,
      action: 'project_update.created',
      entityType: 'project_update',
      entityId: saved.id,
      changes: {
        project_id: params.id,
        period_from: periodFrom.toISOString(),
        period_to: periodTo.toISOString(),
        generated_by_cron: false,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/[id]/updates error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
