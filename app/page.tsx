export const dynamic = "force-dynamic";
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ViewTabsWrapper from '@/components/layout/ViewTabsWrapper';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import ProjectFilter from '@/components/dashboard/ProjectFilter';
import Sparkline from '@/components/dashboard/Sparkline';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';

export default async function HomePage({ searchParams }: { searchParams: { project_id?: string; board_id?: string } }) {
  const sp = await searchParams;
  let project_id = sp.project_id;

  // If board_id is provided without project_id, resolve project from board
  if (!project_id && sp.board_id) {
    const b = await query<{ project_id: string }>(`SELECT project_id FROM boards WHERE id = $1`, [sp.board_id]);
    project_id = b.rows[0]?.project_id;
  }

  // Basic UUID guard to prevent SQL injection via interpolation below
  const isValidUuid = typeof project_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project_id);
  const safeProjectId = isValidUuid ? project_id : undefined;

  // Resolve a board_id for the ViewTabs (prefer the one in URL, else the project's default)
  let tabsBoardId: string | undefined = sp.board_id;
  if (!tabsBoardId && safeProjectId) {
    const defaultBoard = await query<{ id: string }>(
      `SELECT id FROM boards WHERE project_id = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1`,
      [safeProjectId]
    );
    tabsBoardId = defaultBoard.rows[0]?.id;
  }

  const projectFilter = safeProjectId ? `AND project_id = '${safeProjectId}'` : '';
  const projectFilterWhere = safeProjectId ? `WHERE is_archived = false AND project_id = '${safeProjectId}'` : `WHERE is_archived = false`;
  const sprintFilter = safeProjectId ? `AND project_id = '${safeProjectId}'` : '';

  const [
    ticketStats, statsDelta, sprintRow, recentTickets,
    byStatus, byService, byPriority,
    weeklyCompleted, byAssignee, sprintBurndown,
    byType, projectsList
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE is_archived = false ${projectFilter}) AS total_active,
        COUNT(*) FILTER (WHERE is_done = true AND completed_at > NOW() - INTERVAL '7 days' ${projectFilter}) AS completed_week,
        COUNT(*) FILTER (WHERE is_archived = false AND status_name = 'AGUARDANDO' ${projectFilter}) AS waiting,
        COUNT(*) FILTER (WHERE is_archived = false AND priority = 'urgent' ${projectFilter}) AS urgent
      FROM tickets_full
    `),
    // Deltas semana atual vs anterior
    query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' ${projectFilter})::int AS new_week,
        COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days' ${projectFilter})::int AS new_prev_week,
        COUNT(*) FILTER (WHERE is_done = true AND completed_at > NOW() - INTERVAL '7 days' ${projectFilter})::int AS done_week,
        COUNT(*) FILTER (WHERE is_done = true AND completed_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days' ${projectFilter})::int AS done_prev_week
      FROM tickets_full
    `),
    query(`SELECT id, name, start_date, end_date FROM sprints WHERE is_active = true ${sprintFilter} LIMIT 1`),
    query(`
      SELECT ticket_key, id, title, status_name, status_color, priority, assignee_name, service_name
      FROM tickets_full
      ${projectFilterWhere}
      ORDER BY updated_at DESC
      LIMIT 8
    `),
    query(`
      SELECT status_name AS name, status_color AS color, COUNT(*)::int AS value
      FROM tickets_full
      ${projectFilterWhere}
      GROUP BY status_name, status_color
      ORDER BY value DESC
    `),
    query(`
      SELECT COALESCE(service_name, 'Sem serviço') AS name, COALESCE(service_color, '#6b7280') AS color, COUNT(*)::int AS value
      FROM tickets_full
      ${projectFilterWhere}
      GROUP BY service_name, service_color
      ORDER BY value DESC
    `),
    query(`
      SELECT
        CASE priority
          WHEN 'urgent' THEN 'Urgente'
          WHEN 'high' THEN 'Alta'
          WHEN 'medium' THEN 'Média'
          WHEN 'low' THEN 'Baixa'
          ELSE 'Média'
        END AS name,
        CASE priority
          WHEN 'urgent' THEN '#ef4444'
          WHEN 'high' THEN '#f97316'
          WHEN 'medium' THEN '#eab308'
          WHEN 'low' THEN '#60a5fa'
          ELSE '#eab308'
        END AS color,
        COUNT(*)::int AS value
      FROM tickets_full
      ${projectFilterWhere}
      GROUP BY priority
      ORDER BY value DESC
    `),
    // Tickets concluídos por semana (últimas 8 semanas)
    query(`
      SELECT
        to_char(date_trunc('week', completed_at), 'DD/MM') AS week,
        COUNT(*)::int AS value
      FROM tickets
      WHERE completed_at IS NOT NULL
        AND completed_at > NOW() - INTERVAL '8 weeks'
        ${projectFilter}
      GROUP BY date_trunc('week', completed_at)
      ORDER BY date_trunc('week', completed_at) ASC
    `),
    // Tickets por responsável
    query(`
      SELECT
        COALESCE(assignee_name, 'Não atribuído') AS name,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_done = true)::int AS done
      FROM tickets_full
      ${projectFilterWhere}
      GROUP BY assignee_name
      ORDER BY total DESC
      LIMIT 8
    `),
    // Sprint burndown (tickets restantes por dia no sprint ativo)
    query(`
      SELECT
        to_char(a.created_at::date, 'DD/MM') AS day,
        COUNT(DISTINCT a.ticket_id) FILTER (WHERE a.new_value IN (
          SELECT name FROM statuses WHERE is_done = true
        ))::int AS completed_cumulative
      FROM activity_log a
      JOIN tickets t ON t.id = a.ticket_id
      WHERE a.field_name = 'status'
        AND t.sprint_id = (SELECT id FROM sprints WHERE is_active = true LIMIT 1)
      GROUP BY a.created_at::date
      ORDER BY a.created_at::date ASC
    `),
    // Entregas por tipo de ticket
    query(`
      SELECT
        COALESCE(type_name, 'Sem tipo') AS name,
        COALESCE(type_color, '#6b7280') AS color,
        COUNT(*)::int AS value,
        COUNT(*) FILTER (WHERE completed_at > NOW() - INTERVAL '30 days')::int AS last_30d,
        COUNT(*) FILTER (WHERE completed_at > NOW() - INTERVAL '7 days')::int AS last_7d
      FROM tickets_full
      WHERE is_done = true AND is_archived = false ${projectFilter}
      GROUP BY type_name, type_color
      ORDER BY value DESC
    `),
    query(`SELECT id, name, color FROM projects WHERE is_archived = false ORDER BY name ASC`)
  ]);

  const stats = ticketStats.rows[0] || { total_active: 0, completed_week: 0, waiting: 0, urgent: 0 };
  const delta = statsDelta.rows[0] || { new_week: 0, new_prev_week: 0, done_week: 0, done_prev_week: 0 };
  const sprint = sprintRow.rows[0] as any;
  const sprintName = sprint?.name || 'Sem sprint';
  const weeklySeries = (weeklyCompleted.rows as Array<{ value: number }>).map((r) => r.value);

  function deltaPct(curr: number, prev: number): { value: string; positive: boolean } | null {
    if (prev === 0) return curr > 0 ? { value: `+${curr}`, positive: true } : null;
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { value: `${pct >= 0 ? '+' : ''}${pct}%`, positive: pct >= 0 };
  }

  const newDelta = deltaPct(delta.new_week, delta.new_prev_week);
  const doneDelta = deltaPct(delta.done_week, delta.done_prev_week);

  const statCards = [
    {
      label: 'Tickets ativos',
      value: stats.total_active,
      delta: newDelta ? `${newDelta.value} esta semana` : null,
      deltaPositive: newDelta?.positive ?? null,
      sparkline: weeklySeries
    },
    {
      label: 'Concluídos · 7d',
      value: stats.completed_week,
      delta: doneDelta ? `${doneDelta.value} vs semana ant.` : null,
      deltaPositive: doneDelta?.positive ?? null,
      sparkline: weeklySeries
    },
    {
      label: 'Aguardando',
      value: stats.waiting,
      delta: null,
      deltaPositive: null,
      sparkline: null
    },
    {
      label: 'Sprint atual',
      value: sprintName,
      delta: sprint?.end_date
        ? `${Math.max(0, Math.ceil((new Date(sprint.end_date).getTime() - Date.now()) / 86400000))} dias restantes`
        : null,
      deltaPositive: null,
      sparkline: null
    }
  ];

  const currentProject = safeProjectId
    ? (projectsList.rows as Array<{ id: string; name: string }>).find((p) => p.id === safeProjectId)
    : undefined;

  // Date breadcrumb (in pt-BR)
  const today = new Date();
  const dateLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {tabsBoardId && <ViewTabsWrapper boardIdOverride={tabsBoardId} />}
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
          <div className="mx-auto max-w-[1200px] space-y-8">
            {/* Editorial header */}
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <p className="page-eyebrow">{dateLabel}</p>
                <h1 className="page-title">
                  {currentProject ? (
                    <>{currentProject.name} <span className="em">— visão do projeto.</span></>
                  ) : (
                    <>Dashboard <span className="em">— visão geral do workspace.</span></>
                  )}
                </h1>
              </div>
              <ProjectFilter projects={projectsList.rows as any[]} />
            </div>

            {/* Stat Cards - editorial with sparklines */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <div key={card.label} className="card-premium p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="section-eyebrow">{card.label}</span>
                    {card.sparkline && card.sparkline.length > 1 && (
                      <Sparkline data={card.sparkline} width={56} height={16} />
                    )}
                  </div>
                  <p className="mt-3 text-[32px] font-semibold text-primary tracking-tight tabular-nums leading-none font-serif">
                    {card.value}
                  </p>
                  {card.delta && (
                    <p className={`mt-3 text-[12px] font-medium ${
                      card.deltaPositive === true ? 'text-[var(--success)]' :
                      card.deltaPositive === false ? 'text-[var(--danger)]' :
                      'text-secondary'
                    }`}>
                      {card.deltaPositive === true && '↑ '}
                      {card.deltaPositive === false && '↓ '}
                      {card.delta}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* All Charts */}
            <DashboardCharts
              byStatus={byStatus.rows as any[]}
              byService={byService.rows as any[]}
              byPriority={byPriority.rows as any[]}
              byType={byType.rows as any[]}
              weeklyCompleted={weeklyCompleted.rows as any[]}
              byAssignee={byAssignee.rows as any[]}
            />

            {/* Recent tickets */}
            <div className="card-premium overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
                <h2 className="text-[13px] font-medium text-primary">Tickets recentes</h2>
                <Link href={(tabsBoardId ? `/board?board_id=${tabsBoardId}` : '/board') as any} className="btn-premium btn-secondary text-[12px] py-1 px-2.5">
                  Ver board
                </Link>
              </div>
              <div className="divide-y divide-border/20">
                {(recentTickets.rows as any[]).map((t) => (
                  <Link
                    key={t.ticket_key}
                    href={`/ticket/${t.id}` as any}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-[var(--overlay-hover)]"
                  >
                    <span className="w-20 shrink-0 font-mono text-[11px] font-bold text-slate-400">{t.ticket_key}</span>
                    <span className="flex-1 truncate text-[13px] font-medium text-slate-300">{t.title}</span>
                    <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: t.status_color + '15', color: t.status_color }}>
                      {t.status_name}
                    </span>
                    <span className="hidden w-28 shrink-0 truncate text-right text-[11px] text-slate-500 sm:inline">{t.assignee_name || '-'}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
