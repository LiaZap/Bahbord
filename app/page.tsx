export const dynamic = "force-dynamic";
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';
import { Columns3, CheckCircle2, Clock, AlertCircle, TrendingUp, Users } from 'lucide-react';

export default async function HomePage() {
  const [
    ticketStats, sprintRow, recentTickets,
    byStatus, byService, byPriority,
    weeklyCompleted, byAssignee, sprintBurndown,
    byType
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE is_archived = false) AS total_active,
        COUNT(*) FILTER (WHERE is_done = true AND completed_at > NOW() - INTERVAL '30 days') AS completed_month,
        COUNT(*) FILTER (WHERE is_archived = false AND status_name = 'AGUARDANDO') AS waiting,
        COUNT(*) FILTER (WHERE is_archived = false AND priority = 'urgent') AS urgent
      FROM tickets_full
    `),
    query(`SELECT id, name, start_date, end_date FROM sprints WHERE is_active = true LIMIT 1`),
    query(`
      SELECT ticket_key, id, title, status_name, status_color, priority, assignee_name, service_name
      FROM tickets_full
      WHERE is_archived = false
      ORDER BY updated_at DESC
      LIMIT 8
    `),
    query(`
      SELECT status_name AS name, status_color AS color, COUNT(*)::int AS value
      FROM tickets_full
      WHERE is_archived = false
      GROUP BY status_name, status_color
      ORDER BY value DESC
    `),
    query(`
      SELECT COALESCE(service_name, 'Sem serviço') AS name, COALESCE(service_color, '#6b7280') AS color, COUNT(*)::int AS value
      FROM tickets_full
      WHERE is_archived = false
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
      WHERE is_archived = false
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
      WHERE is_archived = false
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
      WHERE is_done = true AND is_archived = false
      GROUP BY type_name, type_color
      ORDER BY value DESC
    `)
  ]);

  const stats = ticketStats.rows[0] || { total_active: 0, completed_month: 0, waiting: 0, urgent: 0 };
  const sprint = sprintRow.rows[0] as any;
  const sprintName = sprint?.name || 'Sem sprint';

  const statCards = [
    { label: 'Tickets ativos', value: stats.total_active, icon: Columns3, gradient: 'from-blue-600 to-blue-400', iconBg: 'bg-blue-500/20' },
    { label: 'Sprint atual', value: sprintName, icon: Clock, gradient: 'from-violet-600 to-purple-400', iconBg: 'bg-violet-500/20' },
    { label: 'Concluídos (30d)', value: stats.completed_month, icon: CheckCircle2, gradient: 'from-emerald-600 to-green-400', iconBg: 'bg-emerald-500/20' },
    { label: 'Aguardando', value: stats.waiting, icon: AlertCircle, gradient: 'from-amber-600 to-yellow-400', iconBg: 'bg-amber-500/20' }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
          <div className="mx-auto max-w-[1200px] space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500">Visão geral do workspace Bah!Company</p>
            </div>

            {/* Stat Cards - Premium */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="card-premium group overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-[0.03] group-hover:opacity-[0.06] transition-opacity`} />
                    <div className="relative p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.label}</span>
                        <div className={`rounded-lg p-2 ${card.iconBg}`}>
                          <Icon size={16} className="text-white" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-white tracking-tight">{card.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Charts row 1 - Type delivery */}
            <DashboardCharts
              byStatus={byStatus.rows as any[]}
              byService={byService.rows as any[]}
              byPriority={byPriority.rows as any[]}
              byType={byType.rows as any[]}
            />

            {/* Charts row 2 - Weekly + Assignees */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Weekly completed */}
              <div className="card-premium p-5">
                <h3 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                  <div className="rounded-md bg-emerald-500/10 p-1.5">
                    <TrendingUp size={14} className="text-emerald-400" />
                  </div>
                  Tickets concluídos por semana
                </h3>
                {weeklyCompleted.rows.length > 0 ? (
                  <div className="flex items-end gap-3" style={{ height: 140 }}>
                    {(weeklyCompleted.rows as any[]).map((w, i) => {
                      const max = Math.max(...(weeklyCompleted.rows as any[]).map((x: any) => x.value), 1);
                      const h = (w.value / max) * 100;
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-300">{w.value}</span>
                          <div
                            className="w-full rounded-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-700 shadow-sm shadow-emerald-500/20"
                            style={{ height: `${Math.max(h, 6)}%` }}
                          />
                          <span className="text-[10px] font-medium text-slate-500">{w.week}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-xs text-slate-600">Sem dados ainda</p>
                  </div>
                )}
              </div>

              {/* By assignee */}
              <div className="card-premium p-5">
                <h3 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                  <div className="rounded-md bg-blue-500/10 p-1.5">
                    <Users size={14} className="text-blue-400" />
                  </div>
                  Tickets por responsável
                </h3>
                {(byAssignee.rows as any[]).length > 0 ? (
                  <div className="space-y-3">
                    {(byAssignee.rows as any[]).map((a) => {
                      const max = Math.max(...(byAssignee.rows as any[]).map((x: any) => x.total), 1);
                      const pct = (a.total / max) * 100;
                      const donePct = a.total > 0 ? (a.done / a.total) * 100 : 0;
                      return (
                        <div key={a.name}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="truncate text-[12px] font-medium text-slate-300">{a.name}</span>
                            <span className="text-[11px] font-semibold text-slate-400">{a.done}<span className="text-slate-600">/{a.total}</span></span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface" style={{ width: `${pct}%` }}>
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 shadow-sm shadow-blue-500/20"
                              style={{ width: `${donePct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-xs text-slate-600">Sem dados ainda</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent tickets - Premium */}
            <div className="card-premium overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-300">Tickets recentes</h2>
                <Link href="/board" className="btn-premium btn-secondary text-[11px] py-1.5 px-3">
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
