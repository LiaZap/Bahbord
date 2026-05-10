import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { computeInitiativeProgress } from '@/lib/initiatives';

interface InitiativeRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  health: string;
  health_set_at: string | null;
  health_set_by: string | null;
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

// Linha enriquecida pelo GET com agregados de progresso já calculados em SQL
// (substitui o N+1 de Promise.all(computeInitiativeProgress)).
interface InitiativeRowWithProgress extends InitiativeRow {
  agg_total_tickets: string | number | null;
  agg_completed_tickets: string | number | null;
  agg_projects_count: string | number | null;
  agg_weighted_pct_num: string | number | null;
  agg_weighted_pct_den: string | number | null;
}

const VALID_HEALTH = new Set(['on_track', 'at_risk', 'off_track', 'completed', 'archived']);

/**
 * GET /api/initiatives
 * Lista initiatives do workspace com progresso agregado.
 *
 * Query params:
 *   - health=at_risk|on_track|... → filtra por health específico
 *   - include_archived=true → inclui também 'archived' e 'completed'
 *
 * Por padrão (sem filtros) exclui archived e completed pra não poluir roadmap.
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const workspaceId = await getDefaultWorkspaceId();
    const { searchParams } = new URL(request.url);
    const healthFilter = searchParams.get('health');
    const includeArchived = searchParams.get('include_archived') === 'true';

    const params: unknown[] = [workspaceId];
    let where = `i.workspace_id = $1`;

    if (healthFilter && VALID_HEALTH.has(healthFilter)) {
      params.push(healthFilter);
      where += ` AND i.health = $${params.length}`;
    } else if (!includeArchived) {
      where += ` AND i.health NOT IN ('archived', 'completed')`;
    }

    // OTIMIZAÇÃO N+1: antes fazíamos Promise.all(computeInitiativeProgress) =
    // 1+N queries. Agora consolidamos tudo em 1 query usando CTEs:
    //   1) project_progress: por (initiative, project) pega total/completed/weight
    //      apenas de projects NÃO arquivados — preserva regra original do
    //      computeInitiativeProgress (JOIN projects p ON p.is_archived = false).
    //   2) initiative_progress: agrega por initiative mantendo a MESMA fórmula
    //      de média ponderada do TS:
    //        weightedSum = Σ(pct_proj * weight)   onde pct_proj = (completed/total)*100, 0 se total=0
    //        totalWeight = Σ(weight)
    //        percentage  = ROUND(weightedSum / totalWeight)
    //      Em SQL guardamos numerador/denominador como agregados separados e
    //      finalizamos a divisão em JS pra evitar divisão por zero e manter
    //      simetria byte-a-byte com computeInitiativeProgress.
    //
    // projects_count = COUNT(DISTINCT project_id) considerando só os linhas que
    // entram (já filtradas por p.is_archived = false via INNER JOIN abaixo).
    const result = await query<InitiativeRowWithProgress>(
      `WITH project_progress AS (
         SELECT
           ip.initiative_id,
           ip.project_id,
           COALESCE(ip.weight, 1)::numeric AS weight,
           COUNT(t.id)::int AS total_tickets,
           COUNT(t.id) FILTER (WHERE COALESCE(s.is_done, false) = true)::int AS completed_tickets
         FROM initiative_projects ip
         JOIN projects p ON p.id = ip.project_id AND p.is_archived = false
         LEFT JOIN tickets t ON t.project_id = ip.project_id
         LEFT JOIN statuses s ON s.id = t.status_id
         GROUP BY ip.initiative_id, ip.project_id, ip.weight
       ),
       initiative_progress AS (
         SELECT
           initiative_id,
           SUM(total_tickets)::int AS total_tickets,
           SUM(completed_tickets)::int AS completed_tickets,
           COUNT(DISTINCT project_id)::int AS projects_count,
           -- Numerador da média ponderada: Σ ((completed/total)*100 * weight)
           -- pct_proj = 0 quando total=0 (evita divisão por zero por project)
           SUM(
             CASE WHEN total_tickets = 0 THEN 0
                  ELSE (completed_tickets::numeric / total_tickets) * 100 * weight
             END
           ) AS weighted_pct_num,
           SUM(weight) AS weighted_pct_den
         FROM project_progress
         GROUP BY initiative_id
       )
       SELECT
         i.id, i.workspace_id, i.name, i.description, i.goal,
         i.health, i.health_set_at, i.health_set_by, i.health_note,
         i.start_date, i.target_date, i.color, i.icon,
         i.owner_id, m.display_name AS owner_name,
         i.created_at, i.created_by, i.updated_at,
         COALESCE(ip.total_tickets, 0)        AS agg_total_tickets,
         COALESCE(ip.completed_tickets, 0)    AS agg_completed_tickets,
         COALESCE(ip.projects_count, 0)       AS agg_projects_count,
         ip.weighted_pct_num                  AS agg_weighted_pct_num,
         ip.weighted_pct_den                  AS agg_weighted_pct_den
       FROM initiatives i
       LEFT JOIN members m ON m.id = i.owner_id
       LEFT JOIN initiative_progress ip ON ip.initiative_id = i.id
       WHERE ${where}
       ORDER BY
         CASE i.health
           WHEN 'off_track' THEN 0
           WHEN 'at_risk' THEN 1
           WHEN 'on_track' THEN 2
           WHEN 'completed' THEN 3
           WHEN 'archived' THEN 4
         END,
         i.target_date ASC NULLS LAST,
         i.name ASC`,
      params,
    );

    // Mapeia agregados pro shape esperado { ...row, progress: { ... } } —
    // mesmo formato que computeInitiativeProgress retornava, sem N+1.
    const enriched = result.rows.map((row) => {
      const totalTickets = Number(row.agg_total_tickets) || 0;
      const completedTickets = Number(row.agg_completed_tickets) || 0;
      const projectsCount = Number(row.agg_projects_count) || 0;
      const num = row.agg_weighted_pct_num === null ? 0 : Number(row.agg_weighted_pct_num);
      const den = row.agg_weighted_pct_den === null ? 0 : Number(row.agg_weighted_pct_den);
      const percentage = den === 0 ? 0 : Math.round(num / den);

      // Strip dos campos auxiliares antes de devolver pro client
      const {
        agg_total_tickets: _t,
        agg_completed_tickets: _c,
        agg_projects_count: _p,
        agg_weighted_pct_num: _n,
        agg_weighted_pct_den: _d,
        ...base
      } = row;
      void _t; void _c; void _p; void _n; void _d;

      return {
        ...base,
        progress: {
          percentage,
          completed_tickets: completedTickets,
          total_tickets: totalTickets,
          projects_count: projectsCount,
        },
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('GET /api/initiatives error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST /api/initiatives
 * Body: { name, description?, goal?, start_date?, target_date?, color?, icon?, owner_id?, project_ids?: string[] }
 * Admin only. Cria initiative + bulk inserts em initiative_projects.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let body: {
      name?: string;
      description?: string;
      goal?: string;
      start_date?: string;
      target_date?: string;
      color?: string;
      icon?: string;
      owner_id?: string;
      project_ids?: string[];
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }
    if (name.length > 200) {
      return NextResponse.json({ error: 'name muito longo (máx 200)' }, { status: 400 });
    }

    const workspaceId = await getDefaultWorkspaceId();

    // Valida owner_id se passado (deve ser membro do workspace)
    if (body.owner_id) {
      const ownerCheck = await query(
        `SELECT 1 FROM members WHERE id = $1 AND workspace_id = $2`,
        [body.owner_id, workspaceId],
      );
      if (!ownerCheck.rows[0]) {
        return NextResponse.json({ error: 'owner_id inválido' }, { status: 400 });
      }
    }

    const inserted = await query<{ id: string }>(
      `INSERT INTO initiatives
         (workspace_id, name, description, goal, start_date, target_date,
          color, icon, owner_id, created_by, health_set_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [
        workspaceId,
        name,
        body.description ?? null,
        body.goal ?? null,
        body.start_date ?? null,
        body.target_date ?? null,
        body.color ?? '#3b6cf5',
        body.icon ?? null,
        body.owner_id ?? null,
        auth.id,
      ],
    );

    const initiativeId = inserted.rows[0].id;

    // Bulk insert de project_ids se fornecidos. Validamos que cada project
    // pertence ao workspace pra evitar cross-tenant.
    const projectIds = Array.isArray(body.project_ids)
      ? body.project_ids.filter((p): p is string => typeof p === 'string')
      : [];

    if (projectIds.length > 0) {
      const validProjects = await query<{ id: string }>(
        `SELECT id FROM projects WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
        [projectIds, workspaceId],
      );
      const validIds = validProjects.rows.map((r) => r.id);

      if (validIds.length > 0) {
        await query(
          `INSERT INTO initiative_projects (initiative_id, project_id, added_by)
           SELECT $1, p_id, $3
           FROM UNNEST($2::uuid[]) AS t(p_id)
           ON CONFLICT DO NOTHING`,
          [initiativeId, validIds, auth.id],
        );
      }
    }

    // Retorna initiative completa
    const full = await query<InitiativeRow>(
      `SELECT
         i.id, i.workspace_id, i.name, i.description, i.goal,
         i.health, i.health_set_at, i.health_set_by, i.health_note,
         i.start_date, i.target_date, i.color, i.icon,
         i.owner_id, m.display_name AS owner_name,
         i.created_at, i.created_by, i.updated_at
       FROM initiatives i
       LEFT JOIN members m ON m.id = i.owner_id
       WHERE i.id = $1`,
      [initiativeId],
    );

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId,
      actorId: auth.id,
      action: 'initiative.created',
      entityType: 'initiative',
      entityId: initiativeId,
      changes: {
        name,
        owner_id: body.owner_id ?? null,
        project_count: projectIds.length,
        target_date: body.target_date ?? null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const progress = await computeInitiativeProgress(initiativeId);
    return NextResponse.json({ ...full.rows[0], progress }, { status: 201 });
  } catch (err) {
    console.error('POST /api/initiatives error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
