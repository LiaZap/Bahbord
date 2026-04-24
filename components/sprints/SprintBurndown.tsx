'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, CartesianGrid } from 'recharts';

interface BurndownData {
  total: number;
  days: Array<{ date: string; remaining: number; ideal: number }>;
}

export default function SprintBurndown({ sprintId }: { sprintId: string }) {
  const [data, setData] = useState<BurndownData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sprints/${sprintId}/burndown`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sprintId]);

  if (loading) return <div className="text-xs text-slate-500">Carregando burndown...</div>;
  if (!data) return <div className="text-xs text-slate-500">Sem dados para burndown</div>;

  const chartData = data.days.map((d) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <div className="rounded-lg border border-border/40 bg-surface p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Burndown</h4>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="dateLabel" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-solid)', borderRadius: 8 }}
            labelStyle={{ color: 'var(--text-primary)' }}
          />
          <Line type="monotone" dataKey="ideal" stroke="#64748b" strokeDasharray="5 5" dot={false} name="Ideal" />
          <Area type="monotone" dataKey="remaining" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Restante" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
