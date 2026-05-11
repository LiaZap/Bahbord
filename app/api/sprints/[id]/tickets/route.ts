import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const sprintRes = await query(
      `SELECT id, project_id, workspace_id FROM sprints WHERE id = $1`,
      [params.id]
    );
    const sprint = sprintRes.rows[0];
    if (!sprint) {
      return NextResponse.json({ error: 'Sprint não encontrada' }, { status: 404 });
    }

    const userIsAdmin = isAdmin(auth.role);
    let accessFilter = '';
    const queryParams: unknown[] = [params.id];
    if (!userIsAdmin) {
      queryParams.push(auth.id);
      accessFilter = ` AND (
        EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = tf.project_id AND pr.member_id = $2)
        OR EXISTS (SELECT 1 FROM board_roles br WHERE br.board_id = tf.board_id AND br.member_id = $2)
      )`;
    }

    const result = await query(
      `SELECT
         tf.id, tf.ticket_key, tf.title, tf.priority,
         tf.status_id, tf.status_name, tf.status_color, tf.is_done,
         tf.assignee_id, tf.assignee_name, tf.assignee_avatar,
         tf.type_name, tf.type_icon, tf.type_color,
         tf.due_date, tf.completed_at
       FROM tickets_full tf
       WHERE tf.sprint_id = $1
         AND tf.is_archived = false
         ${accessFilter}
       ORDER BY tf.is_done ASC NULLS FIRST, tf.priority DESC, tf.created_at ASC`,
      queryParams
    );

    return NextResponse.json({ tickets: result.rows });
  } catch (err) {
    console.error('GET /api/sprints/[id]/tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
