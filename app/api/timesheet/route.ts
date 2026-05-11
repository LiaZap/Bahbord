import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const userIsAdmin = isAdmin(auth.role);
    const canSelfTrack = auth.can_track_time === true;
    if (!userIsAdmin && !canSelfTrack) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7';
    const projectId = searchParams.get('project_id');
    const boardId = searchParams.get('board_id');
    const sprintId = searchParams.get('sprint_id');

    const isUuid = (v: string | null) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    const params: unknown[] = [period];
    let memberFilter = '';
    if (!userIsAdmin) {
      params.push(auth.id);
      memberFilter = ` AND te.member_id = $${params.length}`;
    }

    let scopeFilter = '';
    if (isUuid(projectId)) {
      params.push(projectId);
      scopeFilter = ` AND tf.project_id = $${params.length}`;
    } else if (isUuid(boardId)) {
      params.push(boardId);
      scopeFilter = ` AND tf.board_id = $${params.length}`;
    }

    let sprintFilter = '';
    if (sprintId === 'none') {
      // Tickets sem sprint atribuída (sprint_id IS NULL)
      sprintFilter = ` AND tf.sprint_id IS NULL`;
    } else if (isUuid(sprintId)) {
      params.push(sprintId);
      sprintFilter = ` AND tf.sprint_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
        te.id, te.description, te.started_at, te.ended_at,
        te.duration_minutes, te.is_running, te.is_billable, te.created_at,
        te.member_id,
        m.display_name AS member_name,
        tf.ticket_key, tf.title AS ticket_title, tf.project_name,
        tf.sprint_id, tf.sprint_name
      FROM time_entries te
      LEFT JOIN members m ON m.id = te.member_id
      LEFT JOIN tickets_full tf ON tf.id = te.ticket_id
      WHERE te.started_at > NOW() - ($1 || ' days')::interval ${memberFilter} ${scopeFilter} ${sprintFilter}
      ORDER BY te.started_at DESC`,
      params
    );

    const summary = await query(
      `SELECT
        m.display_name AS member_name,
        SUM(te.duration_minutes)::int AS total_minutes,
        SUM(CASE WHEN te.is_billable THEN te.duration_minutes ELSE 0 END)::int AS billable_minutes,
        SUM(CASE WHEN NOT te.is_billable THEN te.duration_minutes ELSE 0 END)::int AS non_billable_minutes,
        COUNT(te.id)::int AS entry_count
      FROM time_entries te
      LEFT JOIN members m ON m.id = te.member_id
      LEFT JOIN tickets_full tf ON tf.id = te.ticket_id
      WHERE te.started_at > NOW() - ($1 || ' days')::interval ${memberFilter} ${scopeFilter} ${sprintFilter}
        AND te.is_running = false
      GROUP BY m.display_name
      ORDER BY total_minutes DESC`,
      params
    );

    return NextResponse.json({
      entries: result.rows,
      summary: summary.rows,
    });
  } catch (err) {
    console.error('GET /api/timesheet error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
