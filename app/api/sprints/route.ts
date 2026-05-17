import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle';
import { sprints, boards, tickets } from '@/lib/schema/tickets';
import { eq, and, ne, asc, isNull, sql } from 'drizzle-orm';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { createSprintSchema, validateBody } from '@/lib/validators';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json([], { status: 200 });
    const wsId = auth.workspace_id;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    // Query complexa com GROUP BY + aggregate + RBAC subqueries — mantida em raw SQL
    // pois Drizzle query builder não suporta COUNT FILTER nativamente
    let whereClause = 's.workspace_id = $1';
    const params: unknown[] = [wsId];

    if (projectId) {
      params.push(projectId);
      whereClause += ` AND s.project_id = $${params.length}`;
    }

    const userIsAdmin = isAdmin(auth.role);
    if (!userIsAdmin) {
      params.push(auth.id);
      const idx = params.length;
      whereClause += ` AND (
        EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = s.project_id AND pr.member_id = $${idx})
        OR EXISTS (SELECT 1 FROM board_roles br JOIN boards b ON b.id = br.board_id WHERE b.project_id = s.project_id AND br.member_id = $${idx})
      )`;
    }

    const result = await query(
      `SELECT s.id, s.name, s.goal, s.start_date, s.end_date, s.is_active, s.is_completed,
        s.created_at, s.completed_at, s.project_id,
        s.auto_rollover, s.cadence_days, s.rollover_strategy,
        s.parent_sprint_id, s.rolled_over_at,
        p.name AS project_name,
        COUNT(t.id)::int AS ticket_count,
        COUNT(t.id) FILTER (WHERE st.is_done = true)::int AS done_count
      FROM sprints s
      LEFT JOIN projects p ON p.id = s.project_id
      LEFT JOIN tickets t ON t.sprint_id = s.id AND t.is_archived = false
      LEFT JOIN statuses st ON st.id = t.status_id
      WHERE ${whereClause}
      GROUP BY s.id, p.name
      ORDER BY s.is_active DESC, s.created_at DESC`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const reqClone = request.clone();
    const validation = await validateBody(request, createSprintSchema);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    const { name, goal, start_date, end_date, project_id } = validation.data;

    let rawBody: Record<string, unknown> = {};
    try {
      rawBody = await reqClone.json();
    } catch {
      rawBody = {};
    }
    const autoRollover = typeof rawBody.auto_rollover === 'boolean' ? rawBody.auto_rollover : false;
    const cadenceDays =
      typeof rawBody.cadence_days === 'number' && rawBody.cadence_days > 0
        ? Math.floor(rawBody.cadence_days)
        : null;
    const rolloverStrategy =
      typeof rawBody.rollover_strategy === 'string' &&
      ['move_incomplete', 'keep_in_place', 'archive_incomplete'].includes(rawBody.rollover_strategy)
        ? rawBody.rollover_strategy
        : 'move_incomplete';

    const [created] = await db.insert(sprints).values({
      workspaceId: auth.workspace_id,
      projectId: project_id || null,
      name: name.trim(),
      goal: goal || null,
      startDate: start_date ? new Date(start_date) : new Date(),
      endDate: end_date ? new Date(end_date) : new Date(),
      isActive: false,
      isCompleted: false,
      autoRollover: autoRollover,
      cadenceDays: cadenceDays,
      rolloverStrategy: rolloverStrategy,
    }).returning();

    if (project_id) {
      await db.insert(boards).values({
        projectId: project_id,
        name: name.trim(),
        type: 'scrum',
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('POST /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    const body = await request.json();
    const { id, action, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    if (action === 'activate') {
      const [sprint] = await db.select({ projectId: sprints.projectId, workspaceId: sprints.workspaceId })
        .from(sprints).where(eq(sprints.id, id));

      if (sprint) {
        if (sprint.projectId) {
          await db.update(sprints).set({ isActive: false }).where(eq(sprints.projectId, sprint.projectId));
        } else {
          await db.update(sprints).set({ isActive: false })
            .where(and(eq(sprints.workspaceId, sprint.workspaceId!), isNull(sprints.projectId)));
        }
      }

      const [activated] = await db.update(sprints)
        .set({ isActive: true })
        .where(eq(sprints.id, id))
        .returning();

      return NextResponse.json(activated);
    }

    if (action === 'complete') {
      const [completingSprint] = await db
        .select({ id: sprints.id, projectId: sprints.projectId, workspaceId: sprints.workspaceId })
        .from(sprints).where(eq(sprints.id, id));

      if (completingSprint) {
        // Find next sprint
        const nextConditions = completingSprint.projectId
          ? and(
              eq(sprints.projectId, completingSprint.projectId),
              eq(sprints.isActive, false),
              eq(sprints.isCompleted, false),
              ne(sprints.id, id)
            )
          : and(
              eq(sprints.workspaceId, completingSprint.workspaceId!),
              isNull(sprints.projectId),
              eq(sprints.isActive, false),
              eq(sprints.isCompleted, false),
              ne(sprints.id, id)
            );

        const [nextSprint] = await db.select({ id: sprints.id })
          .from(sprints)
          .where(nextConditions!)
          .orderBy(asc(sprints.createdAt))
          .limit(1);

        // Mover tickets não-concluídos — usa raw SQL para o subquery com JOIN
        if (nextSprint) {
          await query(
            `UPDATE tickets
             SET sprint_id = $1
             WHERE sprint_id = $2
               AND id IN (
                 SELECT t.id FROM tickets t
                 LEFT JOIN statuses st ON st.id = t.status_id
                 WHERE t.sprint_id = $2
                   AND (st.is_done IS NULL OR st.is_done = false)
               )`,
            [nextSprint.id, id]
          );
        } else {
          await query(
            `UPDATE tickets
             SET sprint_id = NULL
             WHERE sprint_id = $1
               AND id IN (
                 SELECT t.id FROM tickets t
                 LEFT JOIN statuses st ON st.id = t.status_id
                 WHERE t.sprint_id = $1
                   AND (st.is_done IS NULL OR st.is_done = false)
               )`,
            [id]
          );
        }
      }

      const [completed] = await db.update(sprints)
        .set({ isCompleted: true, isActive: false, completedAt: new Date() })
        .where(eq(sprints.id, id))
        .returning();

      return NextResponse.json(completed);
    }

    // Generic field update
    const ALLOWED_PATCH = ['name', 'goal', 'start_date', 'end_date', 'project_id', 'auto_rollover', 'cadence_days', 'rollover_strategy'];
    const updateData: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(fields)) {
      if (!ALLOWED_PATCH.includes(key)) continue;
      if (key === 'rollover_strategy' && typeof val === 'string' &&
          !['move_incomplete', 'keep_in_place', 'archive_incomplete'].includes(val)) {
        return NextResponse.json({ error: 'rollover_strategy inválido' }, { status: 400 });
      }
      if (key === 'cadence_days' && val !== null && val !== undefined) {
        if (typeof val !== 'number' || val <= 0) {
          return NextResponse.json({ error: 'cadence_days deve ser > 0' }, { status: 400 });
        }
      }
      // Map snake_case DB fields → camelCase Drizzle columns
      const columnMap: Record<string, string> = {
        name: 'name', goal: 'goal', start_date: 'startDate', end_date: 'endDate',
        project_id: 'projectId', auto_rollover: 'autoRollover',
        cadence_days: 'cadenceDays', rollover_strategy: 'rolloverStrategy',
      };
      const drizzleKey = columnMap[key];
      if (drizzleKey) {
        // Convert date strings to Date objects
        if ((key === 'start_date' || key === 'end_date') && val) {
          updateData[drizzleKey] = new Date(val as string);
        } else {
          updateData[drizzleKey] = val;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo' }, { status: 400 });
    }

    const [updated] = await db.update(sprints)
      .set(updateData)
      .where(eq(sprints.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    // Verificar tickets associados antes de deletar
    const [check] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(tickets)
      .where(eq(tickets.sprintId, id));

    if (check.cnt > 0) {
      return NextResponse.json(
        { error: `Não é possível remover: ${check.cnt} ticket(s) associado(s) a este sprint` },
        { status: 409 }
      );
    }

    const deleted = await db.delete(sprints).where(eq(sprints.id, id));

    if (deleted.rowCount === 0) {
      return NextResponse.json({ error: 'Sprint não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
