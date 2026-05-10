import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { createSprintSchema, validateBody } from '@/lib/validators';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json([], { status: 200 });
    const wsId = auth.workspace_id;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

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

    // Clonar request para conseguir ler o body cru DEPOIS do validateBody
    // (precisamos dos campos extras de rollover que não estão no schema).
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

    const wsId = auth.workspace_id;

    const result = await query(
      `INSERT INTO sprints
         (workspace_id, project_id, name, goal, start_date, end_date,
          is_active, is_completed, auto_rollover, cadence_days, rollover_strategy)
       VALUES ($1, $2, $3, $4, $5, $6, false, false, $7, $8, $9)
       RETURNING *`,
      [
        wsId,
        project_id || null,
        name.trim(),
        goal || null,
        start_date || null,
        end_date || null,
        autoRollover,
        cadenceDays,
        rolloverStrategy,
      ]
    );

    // Auto-create a board for this sprint inside the project
    if (project_id) {
      await query(
        `INSERT INTO boards (project_id, name, type)
         VALUES ($1, $2, 'scrum')`,
        [project_id, name.trim()]
      );
    }

    return NextResponse.json(result.rows[0], { status: 201 });
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
      // Deactivate only sprints from the same project
      const sprintData = await query(`SELECT project_id, workspace_id FROM sprints WHERE id = $1`, [id]);
      const sprint = sprintData.rows[0];
      if (sprint) {
        if (sprint.project_id) {
          await query(`UPDATE sprints SET is_active = false WHERE project_id = $1`, [sprint.project_id]);
        } else {
          await query(`UPDATE sprints SET is_active = false WHERE workspace_id = $1 AND project_id IS NULL`, [sprint.workspace_id]);
        }
      }
      const result = await query(
        `UPDATE sprints SET is_active = true WHERE id = $1 RETURNING *`,
        [id]
      );
      return NextResponse.json(result.rows[0]);
    }

    if (action === 'complete') {
      // Fetch completing sprint to know its project
      const sprintData = await query(
        `SELECT id, project_id, workspace_id FROM sprints WHERE id = $1`,
        [id]
      );
      const completingSprint = sprintData.rows[0];

      if (completingSprint) {
        // Find the next sprint (same project, not active, not completed, oldest first)
        let nextSprintRes;
        if (completingSprint.project_id) {
          nextSprintRes = await query(
            `SELECT id FROM sprints
             WHERE project_id = $1
               AND is_active = false
               AND is_completed = false
               AND id <> $2
             ORDER BY created_at ASC
             LIMIT 1`,
            [completingSprint.project_id, id]
          );
        } else {
          nextSprintRes = await query(
            `SELECT id FROM sprints
             WHERE workspace_id = $1
               AND project_id IS NULL
               AND is_active = false
               AND is_completed = false
               AND id <> $2
             ORDER BY created_at ASC
             LIMIT 1`,
            [completingSprint.workspace_id, id]
          );
        }

        const nextSprint = nextSprintRes.rows[0];

        if (nextSprint) {
          // Move unfinished tickets to the next sprint
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
          // No next sprint: send unfinished tickets to backlog (sprint_id = NULL)
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

      const result = await query(
        `UPDATE sprints SET is_completed = true, is_active = false, completed_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      return NextResponse.json(result.rows[0]);
    }

    // Generic field update
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const ALLOWED_PATCH = [
      'name',
      'goal',
      'start_date',
      'end_date',
      'project_id',
      'auto_rollover',
      'cadence_days',
      'rollover_strategy',
    ];
    for (const [key, val] of Object.entries(fields)) {
      if (!ALLOWED_PATCH.includes(key)) continue;
      // Validar enum de rollover_strategy
      if (key === 'rollover_strategy' && typeof val === 'string' &&
          !['move_incomplete', 'keep_in_place', 'archive_incomplete'].includes(val)) {
        return NextResponse.json(
          { error: 'rollover_strategy inválido' },
          { status: 400 }
        );
      }
      // Validar cadence_days positivo
      if (key === 'cadence_days' && val !== null && val !== undefined) {
        if (typeof val !== 'number' || val <= 0) {
          return NextResponse.json({ error: 'cadence_days deve ser > 0' }, { status: 400 });
        }
      }
      sets.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE sprints SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return NextResponse.json(result.rows[0]);
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

    const check = await query(`SELECT COUNT(*)::int AS cnt FROM tickets WHERE sprint_id = $1`, [id]);
    if (check.rows[0].cnt > 0) {
      return NextResponse.json(
        { error: `Não é possível remover: ${check.rows[0].cnt} ticket(s) associado(s) a este sprint` },
        { status: 409 }
      );
    }

    const result = await query(`DELETE FROM sprints WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Sprint não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sprints error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
