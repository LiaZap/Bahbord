import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { dispatchWebhook } from '@/lib/webhooks';
import { getAuthMember } from '@/lib/api-auth';
import { createNotification } from '@/lib/notifications';
import { runAutomations } from '@/lib/automations';
import { createTicketSchema } from '@/lib/validators';
import { upsertTicketEmbedding } from '@/lib/embeddings';
import { hasTicketAccess } from '@/lib/access-check';

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const userIsAdmin = auth.role === 'owner' || auth.role === 'admin';
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    // include_snoozed=true desliga o filtro padrão que esconde tickets cuja
    // janela de snooze ainda está ativa (snoozed_until > NOW()).
    const includeSnoozed = searchParams.get('include_snoozed') === 'true';

    // sla_status: 'overdue' | 'warning' | 'ok'
    //   - overdue: sla_due_at < NOW() e ticket não concluído (status.is_done = false)
    //   - warning: sla_due_at entre NOW() e NOW()+24h e não concluído
    //   - ok: resto (inclui tickets sem SLA setado ou já concluídos)
    const slaStatus = searchParams.get('sla_status');
    let slaFilter = '';
    if (slaStatus === 'overdue') {
      slaFilter = `AND t.sla_due_at IS NOT NULL AND t.sla_due_at < NOW()
                   AND COALESCE(s.is_done, false) = false`;
    } else if (slaStatus === 'warning') {
      slaFilter = `AND t.sla_due_at IS NOT NULL
                   AND t.sla_due_at >= NOW()
                   AND t.sla_due_at < (NOW() + INTERVAL '24 hours')
                   AND COALESCE(s.is_done, false) = false`;
    } else if (slaStatus === 'ok') {
      slaFilter = `AND (
        t.sla_due_at IS NULL
        OR t.sla_due_at >= (NOW() + INTERVAL '24 hours')
        OR COALESCE(s.is_done, false) = true
      )`;
    }

    // Não-admin: filtra por tickets de projetos/boards onde tem acesso
    const accessFilter = userIsAdmin
      ? ''
      : `AND (
          EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = t.project_id AND pr.member_id = $1)
          OR EXISTS (SELECT 1 FROM board_roles br WHERE br.board_id = t.board_id AND br.member_id = $1)
        )`;

    const snoozeFilter = includeSnoozed
      ? ''
      : `AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())`;

    const baseQuery = `
      FROM tickets t
      LEFT JOIN statuses s ON s.id = t.status_id
      LEFT JOIN services sv ON sv.id = t.service_id
      LEFT JOIN members m ON m.id = t.assignee_id
      WHERE t.is_archived = false ${accessFilter} ${snoozeFilter} ${slaFilter}`;
    const accessParams: unknown[] = userIsAdmin ? [] : [auth.id];

    // If no page param, return up to LIMIT 500 results (backward compat for
    // board view + realtime refetch em useBoard.ts:77).
    //
    // Antes: SELECT ... ORDER BY created_at DESC (sem LIMIT) — workspace com
    // 5k tickets gerava response de 2MB+ em cada update realtime do Supabase.
    // O Kanban consome só os tickets ativos visíveis nas 4 colunas; 500 é
    // largo o suficiente pra qualquer board real (limite WIP típico ~100).
    //
    // Para listas paginadas full, callers DEVEM usar ?page=1&limit=N (branch
    // abaixo). app/board/page.tsx NÃO usa este endpoint (faz SSR direto via
    // tickets_full), então o cap não afeta o board principal — só o realtime
    // refetch em useBoard.ts.
    if (!pageParam) {
      const result = await query(
        `SELECT
          t.id,
          t.title,
          to_char(t.due_date AT TIME ZONE 'UTC', 'DD Mon YYYY') AS due_date,
          t.snoozed_until,
          t.sla_due_at,
          t.sla_alert_sent_at,
          s.name AS status,
          sv.name AS service,
          m.display_name AS assignee
        ${baseQuery}
        ORDER BY t.created_at DESC
        LIMIT 500`,
        accessParams.length ? accessParams : undefined
      );
      return NextResponse.json(result.rows);
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(limitParam || '50') || 50));
    const offset = (page - 1) * limit;
    const limitIdx = userIsAdmin ? 1 : 2;
    const offsetIdx = userIsAdmin ? 2 : 3;
    const paginParams = userIsAdmin ? [limit, offset] : [auth.id, limit, offset];

    const [countResult, result] = await Promise.all([
      query(`SELECT COUNT(*) AS total ${baseQuery}`, accessParams.length ? accessParams : undefined),
      query(
        `SELECT
          t.id,
          t.title,
          to_char(t.due_date AT TIME ZONE 'UTC', 'DD Mon YYYY') AS due_date,
          t.snoozed_until,
          t.sla_due_at,
          t.sla_alert_sent_at,
          s.name AS status,
          sv.name AS service,
          m.display_name AS assignee
        ${baseQuery}
        ORDER BY t.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        paginParams
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
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await request.json();
    const ticketId = body.id as string | undefined;
    const statusKey = body.status_key as string | undefined;

    if (!ticketId || !statusKey) {
      return NextResponse.json({ error: 'Missing ticket id or status_key' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticketId);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

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

    // Sincroniza ticket_assignees a partir de assignee_ids (opcional).
    // Convenção: o primeiro id da lista vira o primary (mesmo da coluna
    // tickets.assignee_id, que mantemos pra compat com queries existentes).
    // Se assignee_ids não veio mas assignee_id veio, populamos como primary
    // unitário pra manter a tabela consistente desde o create.
    const rawAssigneeIds = Array.isArray(rawBody.assignee_ids)
      ? (rawBody.assignee_ids as unknown[]).filter((v): v is string => typeof v === 'string')
      : null;
    try {
      if (rawAssigneeIds && rawAssigneeIds.length > 0) {
        const primaryId = rawAssigneeIds[0];
        // Se primary diferente de tickets.assignee_id, ajusta a coluna principal
        if (ticket.assignee_id !== primaryId) {
          await query(
            `UPDATE tickets SET assignee_id = $1 WHERE id = $2`,
            [primaryId, ticket.id]
          );
          ticket.assignee_id = primaryId;
        }
        for (let i = 0; i < rawAssigneeIds.length; i++) {
          await query(
            `INSERT INTO ticket_assignees (ticket_id, member_id, is_primary, added_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (ticket_id, member_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
            [ticket.id, rawAssigneeIds[i], i === 0, auth?.id ?? null]
          );
        }
      } else if (ticket.assignee_id) {
        await query(
          `INSERT INTO ticket_assignees (ticket_id, member_id, is_primary, added_by)
           VALUES ($1, $2, true, $3)
           ON CONFLICT (ticket_id, member_id) DO NOTHING`,
          [ticket.id, ticket.assignee_id, auth?.id ?? null]
        );
      }
    } catch (assigneeErr) {
      console.error('Erro ao sincronizar ticket_assignees no create:', assigneeErr);
    }

    dispatchWebhook('ticket.created', ticket);

    // Fire-and-forget: gera embedding semântico para detecção de duplicatas (feature 2.5).
    // Não bloqueia a resposta; falhas (ex: OPENAI_API_KEY ausente, rate limit) são apenas logadas.
    upsertTicketEmbedding(ticket.id, ticket.title, ticket.description).catch((err) => {
      console.error('[embeddings] Falha ao gerar embedding para ticket', ticket.id, err);
    });

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
