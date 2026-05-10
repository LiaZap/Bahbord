import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { rolloverSprint } from '@/lib/sprint-rollover';

/**
 * POST /api/sprints/[id]/rollover
 *
 * Força o rollover de uma sprint AGORA (sem esperar cron).
 * Admin/owner only. Audit log obrigatório.
 *
 * Edge cases tratados pelo helper:
 *   - Sprint sem cadence_days: usa default 7 dias.
 *   - Sprint sem end_date: usa NOW() como base.
 *   - Sprint já rolada: retorna 409.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado: apenas admin/owner' }, { status: 403 });
    }

    // Buscar workspace_id antes de rolar (audit precisa)
    const sprintMeta = await query<{ workspace_id: string; project_id: string | null; name: string }>(
      `SELECT workspace_id, project_id, name FROM sprints WHERE id = $1`,
      [params.id]
    );
    if (!sprintMeta.rows[0]) {
      return NextResponse.json({ error: 'Sprint não encontrada' }, { status: 404 });
    }

    let result;
    try {
      result = await rolloverSprint(params.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao rolar sprint';
      const status = msg.includes('já foi rolada') ? 409 : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: sprintMeta.rows[0].workspace_id,
      actorId: auth.id,
      action: 'sprint.rolled_over',
      entityType: 'sprint',
      entityId: result.old_sprint_id,
      changes: {
        old_sprint_id: result.old_sprint_id,
        new_sprint_id: result.new_sprint_id,
        moved_count: result.moved_count,
        archived_count: result.archived_count,
        strategy: result.strategy,
        triggered_by: 'manual',
        old_sprint_name: sprintMeta.rows[0].name,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/sprints/[id]/rollover error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
