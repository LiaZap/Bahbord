import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

/**
 * POST /api/onboarding/complete
 *
 * Marca o workspace atual como tendo concluído o wizard de onboarding.
 * Apenas owner/admin podem chamar.
 *
 * A coluna `onboarded_at` é criada pela migration `db/043_workspace_onboarded.sql`.
 * Aplicar a migration formalmente — não rodamos DDL em request (P0 de
 * segurança: removido pra evitar superfície de ataque/race condition).
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const wsId = auth.workspace_id;
    const result = await query<{ id: string; onboarded_at: string }>(
      `UPDATE workspaces SET onboarded_at = NOW() WHERE id = $1 RETURNING id, onboarded_at`,
      [wsId]
    );

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: wsId,
      actorId: auth.id,
      action: 'workspace.onboarded',
      entityType: 'workspace',
      entityId: wsId,
      changes: { onboarded_at: result.rows[0]?.onboarded_at ?? null },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, onboarded_at: result.rows[0]?.onboarded_at ?? null });
  } catch (err) {
    console.error('POST /api/onboarding/complete error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
