import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { computeInitiativeProgress } from '@/lib/initiatives';

const VALID_HEALTH = new Set(['on_track', 'at_risk', 'off_track', 'completed', 'archived']);

interface InitiativeRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  health: string;
  health_set_at: string | null;
  health_set_by: string | null;
  health_set_by_name: string | null;
  health_note: string | null;
  start_date: string | null;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

interface ProjectBreakdownRow {
  project_id: string;
  name: string;
  prefix: string;
  color: string | null;
  is_archived: boolean;
  weight: number;
  ticket_count: number;
  completed_count: number;
}

/**
 * Verifica se o auth pode mutar a initiative. Admin sempre. Owner da
 * initiative também pode editar (mas não deletar — delete fica admin-only).
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
 * GET /api/initiatives/[id]
 * Retorna initiative + lista de projects com breakdown + health_history
 * (últimas 5 mudanças via audit_log).
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const initRes = await query<InitiativeRow>(
      `SELECT
         i.id, i.workspace_id, i.name, i.description, i.goal,
         i.health, i.health_set_at, i.health_set_by,
         hsb.display_name AS health_set_by_name,
         i.health_note,
         i.start_date, i.target_date, i.color, i.icon,
         i.owner_id, own.display_name AS owner_name,
         i.created_at, i.created_by, i.updated_at
       FROM initiatives i
       LEFT JOIN members own ON own.id = i.owner_id
       LEFT JOIN members hsb ON hsb.id = i.health_set_by
       WHERE i.id = $1`,
      [params.id],
    );

    const initiative = initRes.rows[0];
    if (!initiative) {
      return NextResponse.json({ error: 'Initiative não encontrada' }, { status: 404 });
    }

    // Garante que auth é membro do mesmo workspace (RBAC simples por workspace).
    if (initiative.workspace_id !== auth.workspace_id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Breakdown por project. Inclui arquivados na listagem (com flag) pra
    // transparência, mas o cálculo de progress agregado em
    // computeInitiativeProgress já os ignora.
    const projectsRes = await query<ProjectBreakdownRow>(
      `SELECT
         p.id AS project_id,
         p.name,
         p.prefix,
         p.color,
         p.is_archived,
         COALESCE(ip.weight, 1) AS weight,
         COUNT(t.id)::int AS ticket_count,
         COUNT(t.id) FILTER (WHERE COALESCE(s.is_done, false) = true)::int AS completed_count
       FROM initiative_projects ip
       JOIN projects p ON p.id = ip.project_id
       LEFT JOIN tickets t ON t.project_id = p.id
       LEFT JOIN statuses s ON s.id = t.status_id
       WHERE ip.initiative_id = $1
       GROUP BY p.id, p.name, p.prefix, p.color, p.is_archived, ip.weight, ip.added_at
       ORDER BY ip.added_at ASC`,
      [params.id],
    );

    const projects = projectsRes.rows.map((r) => ({
      project_id: r.project_id,
      name: r.name,
      prefix: r.prefix,
      color: r.color,
      is_archived: r.is_archived,
      weight: Number(r.weight),
      ticket_count: Number(r.ticket_count),
      completed_count: Number(r.completed_count),
      percentage:
        Number(r.ticket_count) === 0
          ? 0
          : Math.round((Number(r.completed_count) / Number(r.ticket_count)) * 100),
    }));

    // Health history via audit_log. Pode estar vazia se a tabela ainda não
    // tem registros pra essa initiative — tratamos silenciosamente.
    let healthHistory: Array<{
      created_at: string;
      actor_name: string | null;
      from: string | null;
      to: string | null;
      note: string | null;
    }> = [];
    try {
      const histRes = await query<{
        created_at: string;
        actor_name: string | null;
        changes: Record<string, unknown>;
      }>(
        `SELECT al.created_at, m.display_name AS actor_name, al.changes
         FROM audit_log al
         LEFT JOIN members m ON m.id = al.actor_id
         WHERE al.entity_type = 'initiative'
           AND al.entity_id = $1
           AND al.action = 'initiative.health_changed'
         ORDER BY al.created_at DESC
         LIMIT 5`,
        [params.id],
      );
      healthHistory = histRes.rows.map((r) => ({
        created_at: r.created_at,
        actor_name: r.actor_name,
        from: (r.changes?.from as string) ?? null,
        to: (r.changes?.to as string) ?? null,
        note: (r.changes?.note as string) ?? null,
      }));
    } catch {
      // audit_log indisponível — segue sem history
      healthHistory = [];
    }

    const progress = await computeInitiativeProgress(params.id);

    return NextResponse.json({
      ...initiative,
      progress,
      projects,
      health_history: healthHistory,
    });
  } catch (err) {
    console.error('GET /api/initiatives/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * PATCH /api/initiatives/[id]
 * Body: { name?, description?, goal?, health?, health_note?, start_date?,
 *         target_date?, color?, icon?, owner_id?, project_ids?: string[] }
 *
 * - Admin OU owner da initiative pode editar.
 * - Mudança de health → registra health_set_at/by/note + audit log
 *   'initiative.health_changed' separado do 'initiative.updated'.
 * - project_ids: substitui lista (DELETE + INSERT). Se omitido, mantém.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const allowed = await canMutate(auth.id, auth.role, params.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let body: {
      name?: string;
      description?: string | null;
      goal?: string | null;
      health?: string;
      health_note?: string | null;
      start_date?: string | null;
      target_date?: string | null;
      color?: string;
      icon?: string | null;
      owner_id?: string | null;
      project_ids?: string[];
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    // Carrega estado atual pra detectar mudança de health + obter workspace
    const currentRes = await query<{
      workspace_id: string;
      health: string;
      owner_id: string | null;
    }>(
      `SELECT workspace_id, health, owner_id FROM initiatives WHERE id = $1`,
      [params.id],
    );
    const current = currentRes.rows[0];
    if (!current) {
      return NextResponse.json({ error: 'Initiative não encontrada' }, { status: 404 });
    }

    // Valida health antes de montar UPDATE
    if (body.health !== undefined && !VALID_HEALTH.has(body.health)) {
      return NextResponse.json({ error: 'health inválido' }, { status: 400 });
    }

    // Valida owner_id se mudando
    if (body.owner_id !== undefined && body.owner_id !== null) {
      const ownerCheck = await query(
        `SELECT 1 FROM members WHERE id = $1 AND workspace_id = $2`,
        [body.owner_id, current.workspace_id],
      );
      if (!ownerCheck.rows[0]) {
        return NextResponse.json({ error: 'owner_id inválido' }, { status: 400 });
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const changedFields: Record<string, unknown> = {};

    const fields: Array<[string, unknown, string]> = [
      ['name', body.name, 'name'],
      ['description', body.description, 'description'],
      ['goal', body.goal, 'goal'],
      ['start_date', body.start_date, 'start_date'],
      ['target_date', body.target_date, 'target_date'],
      ['color', body.color, 'color'],
      ['icon', body.icon, 'icon'],
      ['owner_id', body.owner_id, 'owner_id'],
    ];
    for (const [col, val, label] of fields) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx}`);
        values.push(val);
        changedFields[label] = val;
        idx++;
      }
    }

    const healthChanged = body.health !== undefined && body.health !== current.health;
    if (healthChanged) {
      sets.push(`health = $${idx}`);
      values.push(body.health);
      idx++;
      sets.push(`health_set_at = NOW()`);
      sets.push(`health_set_by = $${idx}`);
      values.push(auth.id);
      idx++;
      sets.push(`health_note = $${idx}`);
      values.push(body.health_note ?? null);
      idx++;
    } else if (body.health_note !== undefined) {
      // Permite atualizar nota sem mudar health (ex: complementar justificativa)
      sets.push(`health_note = $${idx}`);
      values.push(body.health_note);
      idx++;
    }

    if (sets.length === 0 && body.project_ids === undefined) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    if (sets.length > 0) {
      sets.push(`updated_at = NOW()`);
      values.push(params.id);
      await query(
        `UPDATE initiatives SET ${sets.join(', ')} WHERE id = $${idx}`,
        values,
      );
    }

    // Substituição de project_ids: DELETE all + INSERT new. Idempotente.
    if (Array.isArray(body.project_ids)) {
      const projectIds = body.project_ids.filter((p): p is string => typeof p === 'string');

      // Valida ownership dos projects no workspace
      let validIds: string[] = [];
      if (projectIds.length > 0) {
        const validRes = await query<{ id: string }>(
          `SELECT id FROM projects WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
          [projectIds, current.workspace_id],
        );
        validIds = validRes.rows.map((r) => r.id);
      }

      await query(
        `DELETE FROM initiative_projects WHERE initiative_id = $1`,
        [params.id],
      );

      if (validIds.length > 0) {
        await query(
          `INSERT INTO initiative_projects (initiative_id, project_id, added_by)
           SELECT $1, p_id, $3
           FROM UNNEST($2::uuid[]) AS t(p_id)
           ON CONFLICT DO NOTHING`,
          [params.id, validIds, auth.id],
        );
      }
      changedFields.project_ids = validIds;
    }

    const meta = extractRequestMeta(request);

    if (healthChanged) {
      await logAudit({
        workspaceId: current.workspace_id,
        actorId: auth.id,
        action: 'initiative.health_changed',
        entityType: 'initiative',
        entityId: params.id,
        changes: {
          from: current.health,
          to: body.health,
          note: body.health_note ?? null,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    if (Object.keys(changedFields).length > 0 || sets.length > 0) {
      await logAudit({
        workspaceId: current.workspace_id,
        actorId: auth.id,
        action: 'initiative.updated',
        entityType: 'initiative',
        entityId: params.id,
        changes: changedFields,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    // Retorna initiative atualizada com progress
    const updatedRes = await query<InitiativeRow>(
      `SELECT
         i.id, i.workspace_id, i.name, i.description, i.goal,
         i.health, i.health_set_at, i.health_set_by, i.health_note,
         i.start_date, i.target_date, i.color, i.icon,
         i.owner_id, m.display_name AS owner_name,
         i.created_at, i.created_by, i.updated_at
       FROM initiatives i
       LEFT JOIN members m ON m.id = i.owner_id
       WHERE i.id = $1`,
      [params.id],
    );

    const progress = await computeInitiativeProgress(params.id);
    return NextResponse.json({ ...updatedRes.rows[0], progress });
  } catch (err) {
    console.error('PATCH /api/initiatives/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/initiatives/[id]
 * Admin only. CASCADE remove vínculos initiative_projects automaticamente.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Cross-tenant safe: bloqueia delete de initiative de outro workspace
    const result = await query<{ workspace_id: string; name: string }>(
      `DELETE FROM initiatives WHERE id = $1 AND workspace_id = $2 RETURNING workspace_id, name`,
      [params.id, auth.workspace_id],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Initiative não encontrada' }, { status: 404 });
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: result.rows[0].workspace_id,
      actorId: auth.id,
      action: 'initiative.deleted',
      entityType: 'initiative',
      entityId: params.id,
      changes: { name: result.rows[0].name },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/initiatives/[id] error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
