import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { db } from '@/lib/drizzle';
import { statuses } from '@/lib/schema/core';
import { tickets } from '@/lib/schema/tickets';
import { eq, sql } from 'drizzle-orm';
import { getAuthMember } from '@/lib/api-auth';
import { createTicketSchema } from '@/lib/validators';
import { hasTicketAccess } from '@/lib/access-check';
import { extractRequestMeta } from '@/lib/audit';
import { createTicket, type TicketPriority } from '@/lib/tickets';

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

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(limitParam || '50', 10) || 50));
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

    const total = parseInt(countResult.rows[0].total, 10);

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
    const statusId = body.status_id as string | undefined;
    const statusKey = body.status_key as string | undefined;

    if (!ticketId || (!statusId && !statusKey)) {
      return NextResponse.json({ error: 'Missing ticket id or status_id/status_key' }, { status: 400 });
    }

    const allowed = await hasTicketAccess(auth, ticketId);
    if (!allowed) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    let resolvedStatusId: string;

    if (statusId) {
      // Modo novo: status_id direto (UUID)
      const [found] = await db.select({ id: statuses.id, isDone: statuses.isDone })
        .from(statuses).where(eq(statuses.id, statusId));
      if (!found) {
        return NextResponse.json({ error: 'Status não encontrado' }, { status: 404 });
      }
      resolvedStatusId = statusId;
    } else {
      // Modo legado: status_key com pattern matching
      const statusPatterns: Record<string, string[]> = {
        todo: ['INICIADO', 'TODO', 'ABERTO', 'NOVO'],
        waiting: ['AGUARDANDO', 'RESPOSTA', 'WAITING', 'PENDENTE'],
        progress: ['PROGRESSO', 'ANDAMENTO', 'PROGRESS', 'DOING'],
        done: ['CONCLU', 'DONE', 'FINALIZADO', 'FEITO']
      };

      const patterns = statusPatterns[statusKey!];
      if (!patterns) {
        return NextResponse.json({ error: 'Invalid status_key' }, { status: 400 });
      }

      const statusResult = await query(
        `SELECT id, name FROM statuses
         WHERE ${patterns.map((_, i) => `UPPER(name) LIKE '%' || $${i + 1} || '%'`).join(' OR ')}
         ORDER BY position ASC LIMIT 1`,
        patterns
      );

      if (!statusResult.rows[0]) {
        return NextResponse.json({ error: `Nenhum status encontrado para "${statusKey}"` }, { status: 404 });
      }
      resolvedStatusId = statusResult.rows[0].id;
    }

    // Buscar se o status destino marca como "concluído"
    const [targetStatus] = await db.select({ isDone: statuses.isDone })
      .from(statuses).where(eq(statuses.id, resolvedStatusId));

    // Atualizar ticket com lógica de completed_at
    const [updated] = await db.update(tickets)
      .set({
        statusId: resolvedStatusId,
        updatedAt: new Date(),
        completedAt: targetStatus?.isDone
          ? sql`COALESCE(${tickets.completedAt}, NOW())`
          : null,
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
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

    // Sincroniza ticket_assignees a partir de assignee_ids (opcional).
    // Convenção: o primeiro id da lista vira o primary. Se assignee_ids
    // não veio mas assignee_id veio, populamos como primary unitário.
    const rawAssigneeIds = Array.isArray(rawBody.assignee_ids)
      ? (rawBody.assignee_ids as unknown[]).filter((v): v is string => typeof v === 'string')
      : undefined;

    const meta = extractRequestMeta(request);

    // Toda a lógica de INSERT + ticket_assignees + embedding + webhook +
    // automations + notificação foi consolidada em lib/tickets.createTicket
    // (Fase 6 — antes era duplicada em 5 callers com gaps divergentes).
    const ticket = await createTicket(
      {
        workspace_id: workspaceId,
        project_id: (body.project_id as string | null | undefined) ?? null,
        board_id: (body.board_id as string | null | undefined) ?? null,
        status_id: (body.status_id as string | null | undefined) ?? null,
        ticket_type_id: (body.ticket_type_id as string | null | undefined) ?? null,
        service_id: (body.service_id as string | null | undefined) ?? null,
        category_id: (body.category_id as string | null | undefined) ?? null,
        client_id: (body.client_id as string | null | undefined) ?? null,
        sprint_id: (body.sprint_id as string | null | undefined) ?? null,
        title: body.title as string,
        description: (body.description as string | null | undefined) ?? null,
        priority: (body.priority as TicketPriority | undefined) ?? 'medium',
        due_date: (body.due_date as string | null | undefined) ?? null,
        assignee_id: (body.assignee_id as string | null | undefined) ?? null,
        assignee_ids: rawAssigneeIds,
        reporter_id: (body.reporter_id as string | null | undefined) ?? null,
        parent_id: (body.parent_id as string | null | undefined) ?? null,
        source: 'manual',
      },
      {
        actor_id: auth?.id ?? null,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      }
    );

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    console.error('POST /api/tickets error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
