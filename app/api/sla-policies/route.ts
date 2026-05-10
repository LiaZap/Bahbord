import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

/**
 * GET /api/sla-policies
 *
 * Lista políticas SLA do workspace do usuário (4 priorities).
 * Permissão: qualquer membro autenticado (read-only).
 */
export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const result = await query(
      `SELECT id, workspace_id, priority, hours_to_resolve, alert_hours_before,
              enabled, created_at, updated_at
       FROM sla_policies
       WHERE workspace_id = $1
       ORDER BY
         CASE priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END`,
      [auth.workspace_id]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/sla-policies error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
