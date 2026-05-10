import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';

const VALID_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
type Priority = (typeof VALID_PRIORITIES)[number];

/**
 * PUT /api/sla-policies/[priority]
 * body: { hours_to_resolve?: number, alert_hours_before?: number, enabled?: boolean }
 *
 * Atualiza policy. Admin/owner only.
 *
 * Edge case: ao mudar hours_to_resolve, sla_due_at de tickets EXISTENTES NÃO
 * é recalculado automaticamente — só recalcula em INSERT ou priority change.
 * Pra recalcular tudo, devops-eng-3a roda job/cron de reconciliação.
 *
 * Se policy não existir pra essa priority/workspace, faz INSERT (UPSERT).
 */
export async function PUT(
  request: Request,
  { params }: { params: { priority: string } }
) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Apenas admins podem editar SLA' }, { status: 403 });
    }

    const priority = params.priority as Priority;
    if (!VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `priority inválido. Use: ${VALID_PRIORITIES.join(', ')}` },
        { status: 400 }
      );
    }

    let body: {
      hours_to_resolve?: number;
      alert_hours_before?: number;
      enabled?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    // Validação dos campos
    let hoursToResolve: number | undefined;
    let alertHoursBefore: number | undefined;
    let enabled: boolean | undefined;

    if (body.hours_to_resolve !== undefined) {
      const n = Number(body.hours_to_resolve);
      if (!Number.isFinite(n) || n <= 0 || n > 8760) {
        return NextResponse.json(
          { error: 'hours_to_resolve precisa ser inteiro entre 1 e 8760' },
          { status: 400 }
        );
      }
      hoursToResolve = Math.floor(n);
    }
    if (body.alert_hours_before !== undefined) {
      const n = Number(body.alert_hours_before);
      if (!Number.isFinite(n) || n < 0 || n > 8760) {
        return NextResponse.json(
          { error: 'alert_hours_before precisa ser inteiro entre 0 e 8760' },
          { status: 400 }
        );
      }
      alertHoursBefore = Math.floor(n);
    }
    if (body.enabled !== undefined) enabled = Boolean(body.enabled);

    if (hoursToResolve === undefined && alertHoursBefore === undefined && enabled === undefined) {
      return NextResponse.json({ error: 'Nenhum campo pra atualizar' }, { status: 400 });
    }

    // Snapshot anterior pra audit
    const beforeRes = await query<{
      hours_to_resolve: number;
      alert_hours_before: number;
      enabled: boolean;
    }>(
      `SELECT hours_to_resolve, alert_hours_before, enabled
       FROM sla_policies WHERE workspace_id = $1 AND priority = $2`,
      [auth.workspace_id, priority]
    );

    // UPSERT: se já existe, faz UPDATE preservando campos não enviados;
    // se não existe, INSERT com defaults sensatos.
    const defaultsHours = priority === 'urgent' ? 24
      : priority === 'high' ? 168
      : priority === 'medium' ? 336
      : 720;
    const defaultsAlert = priority === 'urgent' ? 4
      : priority === 'high' ? 24
      : priority === 'medium' ? 48
      : 72;

    const finalHours = hoursToResolve ?? beforeRes.rows[0]?.hours_to_resolve ?? defaultsHours;
    const finalAlert = alertHoursBefore ?? beforeRes.rows[0]?.alert_hours_before ?? defaultsAlert;
    const finalEnabled = enabled ?? beforeRes.rows[0]?.enabled ?? true;

    const result = await query(
      `INSERT INTO sla_policies (workspace_id, priority, hours_to_resolve, alert_hours_before, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, priority) DO UPDATE
       SET hours_to_resolve = EXCLUDED.hours_to_resolve,
           alert_hours_before = EXCLUDED.alert_hours_before,
           enabled = EXCLUDED.enabled,
           updated_at = NOW()
       RETURNING id, workspace_id, priority, hours_to_resolve, alert_hours_before, enabled, updated_at`,
      [auth.workspace_id, priority, finalHours, finalAlert, finalEnabled]
    );

    const meta = extractRequestMeta(request);
    logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'sla_policy.updated',
      entityType: 'sla_policy',
      entityId: result.rows[0]?.id ?? null,
      changes: {
        priority,
        before: beforeRes.rows[0] || null,
        after: {
          hours_to_resolve: finalHours,
          alert_hours_before: finalAlert,
          enabled: finalEnabled,
        },
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/sla-policies/[priority] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
