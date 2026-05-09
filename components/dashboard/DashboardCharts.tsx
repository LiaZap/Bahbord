'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, ResponsiveContainer, AreaChart, Area, CartesianGrid
} from 'recharts';
import { Package, BarChart3, Target, Activity } from 'lucide-react';

interface ChartData { name: string; color: string; value: number; }
interface TypeChartData extends ChartData { last_30d: number; last_7d: number; }

interface DashboardChartsProps {
  byStatus: ChartData[];
  byService: ChartData[];
  byPriority: ChartData[];
  byType: TypeChartData[];
  weeklyCompleted: Array<{ week: string; value: number }>;
  byAssignee: Array<{ name: string; total: number; done: number }>;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--modal-bg)] px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <span className="text-secondary-muted">{payload[0].payload.name || payload[0].payload.week}: </span>
      <span className="font-bold text-primary tabular-nums">{payload[0].value}</span>
    </div>
  );
}

type PeriodFilter = '7d' | '30d' | 'all';

export default function DashboardCharts({ byStatus, byService, byPriority, byType, weeklyCompleted, byAssignee }: DashboardChartsProps) {
  const [typePeriod, setTypePeriod] = useState<PeriodFilter>('all');
  const filteredByType = byType.map((t) => ({
    ...t,
    value: typePeriod === '7d' ? t.last_7d : typePeriod === '30d' ? t.last_30d : t.value,
  })).filter((t) => t.value > 0);
  const totalDelivered = filteredByType.reduce((sum, t) => sum + t.value, 0);
  const totalTickets = byStatus.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-4">
      {/* Row 1: Entregas + Status bar chart */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Entregas por tipo - Large card */}
        <div className="lg:col-span-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-primary">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
                <Package size={16} className="text-violet-400" />
              </div>
              Entregas por tipo
            </h3>
            <div className="flex gap-0.5 rounded-lg bg-[var(--overlay-subtle)] p-0.5">
              {([['7d', '7D'], ['30d', '30D'], ['all', 'Todos']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTypePeriod(key)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
                    typePeriod === key
                      ? 'bg-accent text-white shadow-sm shadow-accent/30'
                      : 'text-secondary-muted hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredByType.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredByType.slice(0, 8).map((t) => (
                <div key={t.name} className="rounded-xl bg-[var(--overlay-subtle)] border border-[var(--card-border)] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: t.color }}>
                      {t.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate text-[11px] font-semibold text-secondary-muted">{t.name}</span>
                  </div>
                  <p className="text-2xl font-bold text-primary tabular-nums">{t.value}</p>
                  {typePeriod === 'all' && (
                    <div className="mt-1 flex gap-2 text-[9px] text-tertiary-muted tabular-nums">
                      <span>30d: {t.last_30d}</span>
                      <span>7d: {t.last_7d}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-tertiary-muted">Sem entregas no período</div>
          )}
        </div>

        {/* Top por prioridade - Ranking style */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
              <Target size={16} className="text-amber-400" />
            </div>
            Prioridade
          </h3>
          <div className="space-y-3">
            {byPriority.map((p, i) => {
              const max = Math.max(...byPriority.map((x) => x.value), 1);
              const pct = (p.value / max) * 100;
              return (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: p.color }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-primary">{p.name}</span>
                      <span className="text-[13px] font-bold text-primary tabular-nums">{p.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--overlay-subtle)]">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Velocity + Service donut + Status bars */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Velocity - Area chart */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
              <Activity size={16} className="text-emerald-400" />
            </div>
            Velocity Semanal
          </h3>
          {weeklyCompleted.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weeklyCompleted} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <defs>
                  <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#velocityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[180px] items-center justify-center text-xs text-tertiary-muted">Sem dados ainda</div>
          )}
        </div>

        {/* Service donut with center value */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15">
              <BarChart3 size={16} className="text-cyan-400" />
            </div>
            Por Serviço
          </h3>
          <div className="flex items-center">
            <div className="relative" style={{ width: '45%' }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byService} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="none">
                    {byService.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-primary tabular-nums">{totalTickets}</span>
                <span className="text-[9px] text-secondary-muted">Total</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 pl-2">
              {byService.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ backgroundColor: s.color }} />
                  <span className="truncate text-[11px] text-secondary-muted">{s.name}</span>
                  <span className="ml-auto text-[11px] font-bold text-primary tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status - Horizontal bars */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
              <BarChart3 size={16} className="text-blue-400" />
            </div>
            Por Status
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byStatus} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
              <XAxis type="number" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--overlay-subtle)' }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                {byStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Responsáveis */}
      {byAssignee.length > 0 && (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15">
              <Target size={16} className="text-rose-400" />
            </div>
            Performance por Responsável
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {byAssignee.map((a) => {
              const donePct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
              return (
                <div key={a.name} className="rounded-xl bg-[var(--overlay-subtle)] border border-[var(--card-border)] p-4">
                  <p className="truncate text-[12px] font-semibold text-primary mb-2">{a.name}</p>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-2xl font-bold text-primary tabular-nums">{a.done}</span>
                    <span className="text-[12px] text-tertiary-muted mb-0.5 tabular-nums">/ {a.total}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--overlay-subtle)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700" style={{ width: `${donePct}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-tertiary-muted tabular-nums">{donePct}% concluído</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
