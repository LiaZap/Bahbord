import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { dispatchWebhook } from '@/lib/webhooks';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    const baseQuery = `
      FROM tickets t
      LEFT JOIN statuses s ON s.id = t.status_id
      LEFT JOIN services sv ON sv.id = t.service_id
      LEFT JOIN members m ON m.id = t.assignee_id
      WHERE t.is_archived = false`;

    // If no page param, return all results (backward compat for board view)
    if (!pageParam) {
      const result = await query(
        `SELECT
          t.id,
          t.title,
          to_char(t.due_date AT TIME ZONE 'UTC', 'DD Mon YYYY') AS due_date,
          s.name AS status,
          sv.name AS service,
          m.display_name AS assignee
        ${baseQuery}
        ORDER BY t.created_at DESC`
      );
      return NextResponse.json(result.rows);
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(limitParam || '50') || 50));
    const offset = (page - 1) * limit;

    const [countResult, result] = await Promise.all([
      query(`SELECT COUNT(*) AS total ${baseQuery}`),
      query(
        `SELECT
          t.id,
          t.title,
          to_char(t.due_date AT TIME ZONE 'UTC', 'DD Mon YYYY') AS due_date,
          s.name AS status,
          sv.name AS service,
          m.display_name AS assignee
        ${baseQuery}
        ORDER BY t.created_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      data: result.rows,
      pagination: { page, limit, total },
    });
  } catch (err) {
    console.error('GET /api/tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const ticketId = body.id as string | undefined;
    const statusKey = body.status_key as string | undefined;

    if (!ticketId || !statusKey) {
      return NextResponse.json({ error: 'Missing ticket id or status_key' }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      todo: 'NÃO INICIADO',
      waiting: 'AGUARDANDO RESPOSTA',
      progress: 'EM PROGRESSO',
      done: 'CONCLUÍDO'
    };

    const statusName = statusMap[statusKey];
    if (!statusName) {
      return NextResponse.json({ error: 'Invalid status_key' }, { status: 400 });
    }

    const result = await query(
      `UPDATE tickets
       SET status_id = (SELECT id FROM statuses WHERE name = $1),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [statusName, ticketId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();

    const body = await request.json();
    const workspaceId = body.workspace_slug
      ? (await query(`SELECT id FROM workspaces WHERE slug = $1`, [body.workspace_slug])).rows[0]?.id
      : await getDefaultWorkspaceId();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO tickets (
        workspace_id,
        ticket_type_id,
        status_id,
        service_id,
        category_id,
        assignee_id,
        reporter_id,
        title,
        description,
        priority,
        due_date,
        parent_id,
        sprint_id,
        client_id,
        project_id,
        board_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        NOW(), NOW()
      ) RETURNING *`,
      [
        workspaceId,
        body.ticket_type_id,
        body.status_id,
        body.service_id,
        body.category_id ?? null,
        body.assignee_id,
        body.reporter_id,
        body.title,
        body.description,
        body.priority ?? 'medium',
        body.due_date ?? null,
        body.parent_id ?? null,
        body.sprint_id ?? null,
        body.client_id ?? null,
        body.project_id ?? null,
        body.board_id ?? null,
      ]
    );

    const ticket = result.rows[0];
    dispatchWebhook('ticket.created', ticket);
    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    console.error('POST /api/tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
