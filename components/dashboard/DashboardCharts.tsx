'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, ResponsiveContainer } from 'recharts';
import { Package, BarChart3, PieChart as PieIcon, Target } from 'lucide-react';

interface ChartData {
  name: string;
  color: string;
  value: number;
}

interface TypeChartData extends ChartData {
  last_30d: number;
  last_7d: number;
}

interface DashboardChartsProps {
  byStatus: ChartData[];
  byService: ChartData[];
  byPriority: ChartData[];
  byType: TypeChartData[];
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl">
      <span className="text-slate-400">{payload[0].payload.name}: </span>
      <span className="font-bold text-white">{payload[0].value}</span>
    </div>
  );
}

type PeriodFilter = '7d' | '30d' | 'all';

export default function DashboardCharts({ byStatus, byService, byPriority, byType }: DashboardChartsProps) {
  const [typePeriod, setTypePeriod] = useState<PeriodFilter>('all');
  const filteredByType = byType.map((t) => ({
    ...t,
    value: typePeriod === '7d' ? t.last_7d : typePeriod === '30d' ? t.last_30d : t.value,
  })).filter((t) => t.value > 0);

  const totalDelivered = filteredByType.reduce((sum, t) => sum + t.value, 0);

  return (
    <>
    {/* Entregas por tipo de ticket */}
    <div className="card-premium p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          <div className="rounded-md bg-violet-500/10 p-1.5">
            <Package size={14} className="text-violet-400" />
          </div>
          Entregas por tipo de ticket
        </h3>
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          {([['7d', '7 dias'], ['30d', '30 dias'], ['all', 'Todos']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTypePeriod(key)}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-all ${
                typePeriod === key
                  ? 'bg-accent text-white shadow-sm shadow-accent/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredByType.length > 0 ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredByType.slice(0, 8).map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-3 rounded-xl border border-border/30 bg-surface p-3 transition hover:border-border/60"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: t.color }}
                >
                  {t.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-slate-300">{t.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="text-[14px] font-bold text-white">{t.value}</span>
                    {typePeriod === 'all' && (
                      <>
                        <span className="rounded bg-surface2 px-1.5 py-0.5">30d: {t.last_30d}</span>
                        <span className="rounded bg-surface2 px-1.5 py-0.5">7d: {t.last_7d}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center">
            <ResponsiveContainer width="40%" height={200}>
              <PieChart>
                <Pie
                  data={filteredByType}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={75}
                  paddingAngle={3}
                  stroke="none"
                >
                  {filteredByType.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-1 flex-col gap-2">
              {filteredByType.map((t) => {
                const pct = totalDelivered > 0 ? ((t.value / totalDelivered) * 100).toFixed(0) : 0;
                return (
                  <div key={t.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ backgroundColor: t.color }} />
                    <span className="truncate text-[11px] font-medium text-slate-400">{t.name}</span>
                    <span className="ml-auto text-[11px] font-bold text-slate-300">{t.value}</span>
                    <span className="text-[10px] text-slate-600 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center">
          <p className="text-xs text-slate-600">Sem entregas no período selecionado</p>
        </div>
      )}
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      {/* Por Status */}
      <div className="card-premium p-5">
        <h3 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          <div className="rounded-md bg-blue-500/10 p-1.5">
            <BarChart3 size={14} className="text-blue-400" />
          </div>
          Tickets por status
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byStatus} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#969896', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#969896', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(55,59,65,0.2)' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {byStatus.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Por Serviço */}
      <div className="card-premium p-5">
        <h3 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          <div className="rounded-md bg-cyan-500/10 p-1.5">
            <PieIcon size={14} className="text-cyan-400" />
          </div>
          Tickets por serviço
        </h3>
        <div className="flex items-center">
          <ResponsiveContainer width="50%" height={200}>
            <PieChart>
              <Pie
                data={byService}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={75}
                paddingAngle={3}
                stroke="none"
              >
                {byService.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-1 flex-col gap-2">
            {byService.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ backgroundColor: s.color }} />
                <span className="truncate text-[11px] font-medium text-slate-400">{s.name}</span>
                <span className="ml-auto text-[11px] font-bold text-slate-300">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Por Prioridade */}
      <div className="card-premium p-5">
        <h3 className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          <div className="rounded-md bg-amber-500/10 p-1.5">
            <Target size={14} className="text-amber-400" />
          </div>
          Tickets por prioridade
        </h3>
        <div className="space-y-3.5">
          {byPriority.map((p) => {
            const max = Math.max(...byPriority.map((x) => x.value), 1);
            const pct = (p.value / max) * 100;
            return (
              <div key={p.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
                    <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                  <span className="text-[12px] font-bold text-slate-300">{p.value}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${pct}%`, backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}30` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
