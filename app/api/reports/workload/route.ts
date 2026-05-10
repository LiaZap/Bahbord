import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

// ----------------------------------------------------------------------------
// Workload heatmap
// ----------------------------------------------------------------------------
// Retorna, para cada member, a carga semanal (ticket count + soma de minutos
// estimados) durante um período. Usado pelo heatmap de capacity planning.
//
// Decisões:
// - Tickets sem due_date caem na "semana atual" (segunda da week que contém
//   "hoje") quando criado antes de period_to. Evita carga "fantasma" no fim
//   do período.
// - Como tickets.estimate_minutes não existe ainda no schema, usamos fallback
//   FIXO de 60 min por ticket. Se a coluna for adicionada depois, basta trocar
//   o COALESCE abaixo.
// - Semanas agrupadas por DATE_TRUNC('week', ...) (ISO week — segunda como
//   primeiro dia) em UTC. Trade-off: alinhamento universal vs. fuso do user;
//   pra v1 o ganho de simplicidade e consistência cross-timezone vence.
// - is_done filtrado via JOIN com statuses (não t.is_done — esse é só na view
//   tickets_full).
// - RBAC: admin vê todos; não-admin vê apenas seus próprios dados E os de
//   membros que compartilham ao menos um project_role / board_role com ele.
// ----------------------------------------------------------------------------

interface WeekBucket {
  week_start: string;
  week_end: string;
  ticket_count: number;
  estimate_minutes: number;
  tickets: Array<{
    id: string;
    ticket_key: string;
    title: string;
    priority: string;
    due_date: string | null;
    estimate_minutes: number;
  }>;
}

interface MemberWorkload {
  member_id: string;
  display_name: string;
  avatar_url: string | null;
  weeks: WeekBucket[];
  total_minutes: number;
  total_tickets: number;
}

const FALLBACK_MINUTES_PER_TICKET = 60;

function isoMondayUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO week: monday=1 ... sunday=7. Postgres DATE_TRUNC('week') também usa segunda.
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

function generateWeeks(from: Date, to: Date): Array<{ week_start: string; week_end: string }> {
  const weeks: Array<{ week_start: string; week_end: string }> = [];
  const cursor = isoMondayUTC(from);
  while (cursor <= to) {
    const end = new Date(cursor);
    end.setUTCDate(end.getUTCDate() + 6);
    weeks.push({
      week_start: cursor.toISOString().slice(0, 10),
      week_end: end.toISOString().slice(0, 10),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const periodFromRaw = searchParams.get('period_from');
    const periodToRaw = searchParams.get('period_to');
    const projectId = searchParams.get('project_id');
    const memberIdsParam = searchParams.get('member_ids');

    // Defaults: hoje -> +4 semanas
    const today = new Date();
    const defaultFrom = isoMondayUTC(today);
    const defaultTo = new Date(defaultFrom);
    defaultTo.setUTCDate(defaultTo.getUTCDate() + 27); // 4 semanas

    const periodFrom = periodFromRaw ? new Date(periodFromRaw) : defaultFrom;
    const periodTo = periodToRaw ? new Date(periodToRaw) : defaultTo;

    if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) {
      return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 });
    }
    if (periodFrom > periodTo) {
      return NextResponse.json({ error: 'period_from > period_to' }, { status: 400 });
    }

    const requestedMemberIds = memberIdsParam
      ? memberIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    // ------------------------------------------------------------------------
    // 1. Listar members visíveis pra esse usuário
    // ------------------------------------------------------------------------
    const memberParams: Array<unknown> = [auth.workspace_id];
    let memberWhere = 'm.workspace_id = $1';

    if (!isAdmin(auth.role)) {
      // Não-admin: si próprio + members que compartilham project/board role
      memberParams.push(auth.id);
      memberWhere += ` AND (
        m.id = $${memberParams.length}
        OR EXISTS (
          SELECT 1 FROM project_roles pr1
          JOIN project_roles pr2 ON pr2.project_id = pr1.project_id
          WHERE pr1.member_id = $${memberParams.length}
            AND pr2.member_id = m.id
        )
        OR EXISTS (
          SELECT 1 FROM board_roles br1
          JOIN board_roles br2 ON br2.board_id = br1.board_id
          WHERE br1.member_id = $${memberParams.length}
            AND br2.member_id = m.id
        )
      )`;
    }

    if (requestedMemberIds && requestedMemberIds.length > 0) {
      memberParams.push(requestedMemberIds);
      memberWhere += ` AND m.id = ANY($${memberParams.length}::uuid[])`;
    }

    const membersRes = await query<{ id: string; display_name: string; avatar_url: string | null }>(
      `SELECT m.id, m.display_name, m.avatar_url
       FROM members m
       WHERE ${memberWhere}
       ORDER BY m.display_name ASC`,
      memberParams
    );

    if (membersRes.rows.length === 0) {
      return NextResponse.json({
        period: {
          from: periodFrom.toISOString().slice(0, 10),
          to: periodTo.toISOString().slice(0, 10),
        },
        members: [],
      });
    }

    // ------------------------------------------------------------------------
    // 2. Buscar tickets relevantes (open, no período, dos members visíveis)
    // ------------------------------------------------------------------------
    const memberIds = membersRes.rows.map((m) => m.id);
    const ticketParams: Array<unknown> = [
      auth.workspace_id,
      memberIds,
      periodFrom.toISOString(),
      periodTo.toISOString(),
    ];

    let ticketWhere = `t.workspace_id = $1
      AND t.is_archived = false
      AND ta.member_id = ANY($2::uuid[])
      AND (st.is_done IS NULL OR st.is_done = false)
      AND (
        (t.due_date IS NOT NULL AND t.due_date >= $3 AND t.due_date <= $4)
        OR (t.due_date IS NULL AND t.created_at < $4)
      )`;

    if (projectId) {
      ticketParams.push(projectId);
      ticketWhere += ` AND t.project_id = $${ticketParams.length}`;
    }

    const ticketsRes = await query<{
      id: string;
      ticket_key: string;
      title: string;
      priority: string;
      due_date: string | null;
      member_id: string;
    }>(
      `SELECT
         t.id,
         w.prefix || '-' || LPAD(t.sequence_number::text, 3, '0') AS ticket_key,
         t.title,
         t.priority,
         t.due_date,
         ta.member_id
       FROM tickets t
       JOIN workspaces w ON w.id = t.workspace_id
       JOIN ticket_assignees ta ON ta.ticket_id = t.id
       LEFT JOIN statuses st ON st.id = t.status_id
       WHERE ${ticketWhere}`,
      ticketParams
    );

    // ------------------------------------------------------------------------
    // 3. Distribuir tickets nas semanas
    // ------------------------------------------------------------------------
    const weeks = generateWeeks(periodFrom, periodTo);
    const todayMonday = isoMondayUTC(today).toISOString().slice(0, 10);

    // mapa: member_id -> week_start -> bucket
    const buckets = new Map<string, Map<string, WeekBucket>>();
    for (const m of membersRes.rows) {
      const weekMap = new Map<string, WeekBucket>();
      for (const w of weeks) {
        weekMap.set(w.week_start, {
          week_start: w.week_start,
          week_end: w.week_end,
          ticket_count: 0,
          estimate_minutes: 0,
          tickets: [],
        });
      }
      buckets.set(m.id, weekMap);
    }

    function findWeekStart(date: Date): string | null {
      const monday = isoMondayUTC(date).toISOString().slice(0, 10);
      return monday;
    }

    for (const t of ticketsRes.rows) {
      const memberWeeks = buckets.get(t.member_id);
      if (!memberWeeks) continue;

      let targetWeekStart: string | null;
      if (t.due_date) {
        targetWeekStart = findWeekStart(new Date(t.due_date));
      } else {
        // sem due_date: cai na semana de "hoje" se essa semana estiver no range
        targetWeekStart = todayMonday;
      }

      let bucket = targetWeekStart ? memberWeeks.get(targetWeekStart) : null;
      if (!bucket) {
        // fallback: primeira semana do range
        const firstKey = weeks[0]?.week_start;
        bucket = firstKey ? memberWeeks.get(firstKey) ?? null : null;
      }
      if (!bucket) continue;

      const estimate = FALLBACK_MINUTES_PER_TICKET;
      bucket.ticket_count += 1;
      bucket.estimate_minutes += estimate;
      bucket.tickets.push({
        id: t.id,
        ticket_key: t.ticket_key,
        title: t.title,
        priority: t.priority,
        due_date: t.due_date,
        estimate_minutes: estimate,
      });
    }

    // ------------------------------------------------------------------------
    // 4. Montar response
    // ------------------------------------------------------------------------
    const members: MemberWorkload[] = membersRes.rows.map((m) => {
      const weekMap = buckets.get(m.id);
      const weeksArr = weeks.map((w) => weekMap?.get(w.week_start) ?? {
        week_start: w.week_start,
        week_end: w.week_end,
        ticket_count: 0,
        estimate_minutes: 0,
        tickets: [],
      });
      const total_minutes = weeksArr.reduce((s, w) => s + w.estimate_minutes, 0);
      const total_tickets = weeksArr.reduce((s, w) => s + w.ticket_count, 0);
      return {
        member_id: m.id,
        display_name: m.display_name,
        avatar_url: m.avatar_url,
        weeks: weeksArr,
        total_minutes,
        total_tickets,
      };
    });

    return NextResponse.json({
      period: {
        from: periodFrom.toISOString().slice(0, 10),
        to: periodTo.toISOString().slice(0, 10),
      },
      members,
    });
  } catch (err) {
    console.error('GET /api/reports/workload error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
