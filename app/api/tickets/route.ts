import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { dispatchWebhook } from '@/lib/webhooks';
import { getAuthMember } from '@/lib/api-auth';
import { createNotification } from '@/lib/notifications';
import { runAutomations } from '@/lib/automations';
import { createTicketSchema } from '@/lib/validators';

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

    // Map status_key to search patterns (flexible matching)
    const statusPatterns: Record<string, string[]> = {
      todo: ['INICIADO', 'TODO', 'ABERTO', 'NOVO'],
      waiting: ['AGUARDANDO', 'RESPOSTA', 'WAITING', 'PENDENTE'],
      progress: ['PROGRESSO', 'ANDAMENTO', 'PROGRESS', 'DOING'],
      done: ['CONCLU', 'DONE', 'FINALIZADO', 'FEITO']
    };

    const patterns = statusPatterns[statusKey];
    if (!patterns) {
      return NextResponse.json({ error: 'Invalid status_key' }, { status: 400 });
    }

    // Find status matching any pattern
    const statusResult = await query(
      `SELECT id, name FROM statuses
       WHERE ${patterns.map((_, i) => `UPPER(name) LIKE '%' || $${i + 1} || '%'`).join(' OR ')}
       ORDER BY position ASC LIMIT 1`,
      patterns
    );

    if (!statusResult.rows[0]) {
      return NextResponse.json({ error: `Nenhum status encontrado para "${statusKey}"` }, { status: 404 });
    }

    console.log(`Drag: ticket ${ticketId} → status "${statusResult.rows[0].name}" (${statusResult.rows[0].id})`);

    const result = await query(
      `UPDATE tickets
       SET status_id = $1,
           updated_at = NOW(),
           completed_at = CASE WHEN (SELECT is_done FROM statuses WHERE id = $1) = true THEN COALESCE(completed_at, NOW()) ELSE NULL END
       WHERE id = $2
       RETURNING *`,
      [statusResult.rows[0].id, ticketId]
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
    const auth = await getAuthMember();

    // Capture raw JSON first to preserve non-schema fields (e.g. workspace_slug)
    let rawBody: Record<string, unknown>;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createTicketSchema.safeParse(rawBody);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Merge validated/typed fields with raw body so workspace_slug (and other
    // auxiliary fields) remain accessible while the schema-validated fields
    // are guaranteed well-formed.
    const body: Record<string, unknown> = { ...rawBody, ...parsed.data };
    const workspaceSlug = typeof rawBody.workspace_slug === 'string' ? rawBody.workspace_slug : undefined;

    // Auto-set reporter to authenticated user if not provided
    if (!body.reporter_id && auth?.id) {
      body.reporter_id = auth.id;
    }

    // Auto-resolve project_id from board_id if only board_id is provided
    if (body.board_id && !body.project_id) {
      const boardRes = await query(`SELECT project_id FROM boards WHERE id = $1`, [body.board_id]);
      if (boardRes.rows[0]) body.project_id = boardRes.rows[0].project_id;
    }

    // If no project_id/board_id, infer from user's access
    if (!body.project_id && !body.board_id && auth?.id) {
      // Try project_roles first
      const projRes = await query(
        `SELECT project_id FROM project_roles WHERE member_id = $1 LIMIT 1`,
        [auth.id]
      );
      if (projRes.rows[0]) {
        body.project_id = projRes.rows[0].project_id;
        // Get default board of that project
        const boardRes = await query(
          `SELECT id FROM boards WHERE project_id = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1`,
          [body.project_id]
        );
        if (boardRes.rows[0]) body.board_id = boardRes.rows[0].id;
      } else {
        // Try board_roles
        const brRes = await query(
          `SELECT b.id, b.project_id FROM board_roles br JOIN boards b ON b.id = br.board_id WHERE br.member_id = $1 LIMIT 1`,
          [auth.id]
        );
        if (brRes.rows[0]) {
          body.board_id = brRes.rows[0].id;
          body.project_id = brRes.rows[0].project_id;
        }
      }
    }
    const workspaceId = workspaceSlug
      ? (await query(`SELECT id FROM workspaces WHERE slug = $1`, [workspaceSlug])).rows[0]?.id
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

    // Disparar automações (fire-and-forget safe: captura erros internamente)
    await runAutomations({
      ticket,
      event: 'ticket.created',
      workspace_id: workspaceId,
      actor_id: auth?.id,
    });

    // Notificar assignee caso o ticket tenha sido atribuído na criação a outra pessoa
    if (ticket.assignee_id && ticket.assignee_id !== auth?.id) {
      try {
        // Buscar ticket_key a partir da view
        const keyRes = await query(
          `SELECT ticket_key FROM tickets_full WHERE id = $1`,
          [ticket.id]
        );
        const ticketKey = keyRes.rows[0]?.ticket_key || '';
        await createNotification({
          workspace_id: workspaceId,
          recipient_id: ticket.assignee_id,
          actor_id: auth?.id,
          type: 'assigned',
          entity_type: 'ticket',
          entity_id: ticket.id,
          title: `Você foi atribuído ao ticket${ticketKey ? ` ${ticketKey}` : ''}`,
          message: ticket.title,
          link: `/ticket/${ticket.id}`,
        });
      } catch (notifyErr) {
        console.error('Erro ao notificar atribuição na criação do ticket:', notifyErr);
      }
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    console.error('POST /api/tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
