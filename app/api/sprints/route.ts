import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { createSprintSchema, validateBody } from '@/lib/validators';

export async function GET(request: Request) {
  try {
    await getAuthMember();
    const wsId = await getDefaultWorkspaceId();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    let whereClause = 's.workspace_id = $1';
    const params: string[] = [wsId];

    if (projectId) {
      params.push(projectId);
      whereClause += ` AND s.project_id = $${params.length}`;
    }

    const result = await query(
      `SELECT s.id, s.name, s.goal, s.start_date, s.end_date, s.is_active, s.is_completed,
        s.created_at, s.completed_at, s.project_id,
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

    const validation = await validateBody(request, createSprintSchema);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }
    const { name, goal, start_date, end_date, project_id } = validation.data;

    const wsId = await getDefaultWorkspaceId();

    const result = await query(
      `INSERT INTO sprints (workspace_id, project_id, name, goal, start_date, end_date, is_active, is_completed)
       VALUES ($1, $2, $3, $4, $5, $6, false, false)
       RETURNING *`,
      [wsId, project_id || null, name.trim(), goal || null, start_date || null, end_date || null]
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

    for (const [key, val] of Object.entries(fields)) {
      if (['name', 'goal', 'start_date', 'end_date', 'project_id'].includes(key)) {
        sets.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
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
