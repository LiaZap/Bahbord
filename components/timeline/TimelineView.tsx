'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TimelineTicket {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  type_icon: string;
  status_name: string;
  status_color: string;
  service_name: string | null;
  service_color: string | null;
  assignee_name: string | null;
  due_date: string;
  created_at: string;
  completed_at: string | null;
}

const priorityColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#60a5fa',
};

interface TimelineViewProps {
  tickets: TimelineTicket[];
}

export default function TimelineView({ tickets }: TimelineViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Calcular semanas a exibir (6 semanas)
  const weeks = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7); // Monday

    const result: Date[] = [];
    for (let w = 0; w < 6; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + w * 7 + d);
        result.push(date);
      }
    }
    return result;
  }, [weekOffset]);

  const startDate = weeks[0];
  const endDate = weeks[weeks.length - 1];

  // Agrupar tickets por semana
  const ticketsByDay = useMemo(() => {
    const map: Record<string, TimelineTicket[]> = {};
    tickets.forEach((t) => {
      const due = new Date(t.due_date);
      const key = due.toISOString().split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tickets]);

  const today = new Date().toISOString().split('T')[0];

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Extrair meses visíveis
  const visibleMonths = useMemo(() => {
    const months: { name: string; span: number }[] = [];
    let currentMonth = -1;
    weeks.forEach((d) => {
      if (d.getMonth() !== currentMonth) {
        currentMonth = d.getMonth();
        months.push({ name: `${monthNames[currentMonth]} ${d.getFullYear()}`, span: 1 });
      } else {
        months[months.length - 1].span++;
      }
    });
    return months;
  }, [weeks]);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Cronograma</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} com data limite
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((o) => o - 2)}
            className="rounded p-1.5 text-slate-400 transition hover:bg-surface2 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="rounded px-3 py-1 text-xs font-medium text-slate-400 transition hover:bg-surface2 hover:text-white"
          >
            Hoje
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 2)}
            className="rounded p-1.5 text-slate-400 transition hover:bg-surface2 hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="overflow-x-auto rounded-lg border border-border/40 bg-surface2">
        {/* Month header */}
        <div className="flex border-b border-border/30">
          {visibleMonths.map((m, i) => (
            <div
              key={i}
              className="border-r border-border/20 px-2 py-1.5 text-center text-[11px] font-semibold text-slate-400"
              style={{ flex: m.span }}
            >
              {m.name}
            </div>
          ))}
        </div>

        {/* Day header */}
        <div className="flex border-b border-border/40">
          {weeks.map((d, i) => {
            const key = d.toISOString().split('T')[0];
            const isToday = key === today;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className={cn(
                  'flex flex-1 flex-col items-center border-r border-border/20 py-1',
                  isToday && 'bg-accent/10',
                  isWeekend && 'bg-surface/50'
                )}
              >
                <span className="text-[9px] text-slate-600">{dayNames[(d.getDay() + 6) % 7]}</span>
                <span className={cn('text-[11px] font-medium', isToday ? 'text-accent' : 'text-slate-400')}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Ticket rows */}
        <div className="min-h-[300px]">
          {weeks.map((d, i) => {
            const key = d.toISOString().split('T')[0];
            const dayTickets = ticketsByDay[key] || [];
            if (dayTickets.length === 0) return null;

            return dayTickets.map((t) => (
              <div key={`${i}-${t.id}`} className="flex items-center border-b border-border/20 px-2 py-1">
                {/* Position indicator */}
                <div className="flex items-center" style={{ marginLeft: `${(i / weeks.length) * 100}%` }}>
                  <div
                    className="mr-2 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: priorityColors[t.priority] || '#eab308' }}
                  />
                  <Link
                    href={`/ticket/${t.id}`}
                    className="flex items-center gap-1.5 rounded bg-surface px-2 py-1 text-xs transition hover:bg-input/40"
                  >
                    <span>{t.type_icon}</span>
                    <span className="font-mono text-[10px] text-slate-500">{t.ticket_key}</span>
                    <span className="max-w-[200px] truncate text-slate-300">{t.title}</span>
                    <span
                      className="rounded px-1 py-0.5 text-[9px] font-medium"
                      style={{ backgroundColor: t.status_color + '20', color: t.status_color }}
                    >
                      {t.status_name}
                    </span>
                  </Link>
                </div>
              </div>
            ));
          })}

          {Object.keys(ticketsByDay).length === 0 && (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Nenhum ticket com data limite neste período
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
