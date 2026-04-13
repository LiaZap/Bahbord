'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, ResponsiveContainer } from 'recharts';

interface ChartData {
  name: string;
  color: string;
  value: number;
}

interface DashboardChartsProps {
  byStatus: ChartData[];
  byService: ChartData[];
  byPriority: ChartData[];
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border/40 bg-surface2 px-3 py-1.5 text-xs shadow-lg">
      <span className="text-slate-300">{payload[0].payload.name}: </span>
      <span className="font-semibold text-white">{payload[0].value}</span>
    </div>
  );
}

export default function DashboardCharts({ byStatus, byService, byPriority }: DashboardChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Por Status - Bar chart */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Tickets por status
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byStatus} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
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
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(55,59,65,0.3)' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {byStatus.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Por Serviço - Pie chart */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Tickets por serviço
        </h3>
        <div className="flex items-center">
          <ResponsiveContainer width="50%" height={180}>
            <PieChart>
              <Pie
                data={byService}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={65}
                paddingAngle={2}
                stroke="none"
              >
                {byService.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-1 flex-col gap-1.5">
            {byService.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate text-[10px] text-slate-400">{s.name}</span>
                <span className="ml-auto text-[10px] font-medium text-slate-300">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Por Prioridade - Horizontal bar */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Tickets por prioridade
        </h3>
        <div className="space-y-2.5">
          {byPriority.map((p) => {
            const max = Math.max(...byPriority.map((x) => x.value), 1);
            const pct = (p.value / max) * 100;
            return (
              <div key={p.name}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                  <span className="text-[11px] font-medium text-slate-300">{p.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: p.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
