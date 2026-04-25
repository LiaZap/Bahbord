'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';

interface PersonalTicket {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  status_name: string;
  status_color: string;
  type_name: string;
  type_icon: string;
  type_color: string;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  project_prefix: string | null;
  updated_at: string;
}

interface PersonalTicketListProps {
  tickets: PersonalTicket[];
  emptyMessage?: string;
  groupBy?: 'project' | 'priority' | 'none';
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgente', color: '#ef4444' },
  high: { label: 'Alta', color: '#f97316' },
  medium: { label: 'Média', color: '#3b6cf5' },
  low: { label: 'Baixa', color: '#71717a' },
};

function formatDate(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return 'Hoje';
  if (target.getTime() === tomorrow.getTime()) return 'Amanhã';

  const diff = (target.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return `${Math.abs(Math.round(diff))}d atrás`;
  if (diff < 7) return `Em ${Math.round(diff)}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function PersonalTicketList({
  tickets,
  emptyMessage = 'Nada por aqui.',
  groupBy = 'project',
}: PersonalTicketListProps) {
  const groups = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', tickets, color: null }];
    }
    if (groupBy === 'priority') {
      const map = new Map<string, PersonalTicket[]>();
      for (const t of tickets) {
        const k = t.priority || 'medium';
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(t);
      }
      const order = ['urgent', 'high', 'medium', 'low'];
      return order
        .filter((k) => map.has(k))
        .map((k) => ({
          key: k,
          label: priorityLabels[k]?.label || k,
          tickets: map.get(k)!,
          color: priorityLabels[k]?.color || null,
        }));
    }
    // project
    const map = new Map<string, { name: string; color: string | null; tickets: PersonalTicket[] }>();
    for (const t of tickets) {
      const k = t.project_id || '__none__';
      if (!map.has(k)) {
        map.set(k, { name: t.project_name || 'Sem projeto', color: t.project_color, tickets: [] });
      }
      map.get(k)!.tickets.push(t);
    }
    return Array.from(map.entries()).map(([k, v]) => ({
      key: k,
      label: v.name,
      tickets: v.tickets,
      color: v.color,
    }));
  }, [tickets, groupBy]);

  if (tickets.length === 0) {
    return (
      <div className="card-premium p-8 text-center">
        <p className="text-[14px] text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.key}>
          {g.label && (
            <div className="mb-2 flex items-center gap-2 px-1">
              {g.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{g.label}</span>
              <span className="text-[10px] tabular-nums text-[var(--text-tertiary)]">{g.tickets.length}</span>
            </div>
          )}

          <div className="card-premium overflow-hidden">
            {g.tickets.map((t) => {
              const prio = priorityLabels[t.priority] || priorityLabels.medium;
              const due = formatDate(t.due_date);
              const isOverdue = t.due_date && new Date(t.due_date) < new Date();
              return (
                <Link
                  key={t.id}
                  href={`/ticket/${t.id}` as any}
                  className="grid grid-cols-[24px_80px_1fr_auto_auto] items-center gap-3 border-b border-[var(--card-border)] px-4 py-2.5 last:border-0 hover:bg-[var(--overlay-subtle)] transition-colors"
                >
                  <TicketTypeIcon typeName={t.type_name} typeIcon={t.type_icon} size="sm" />
                  <span className="font-mono text-[11px] font-bold text-secondary tabular-nums">{t.ticket_key}</span>
                  <span className="text-[13px] text-primary truncate">{t.title}</span>
                  <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium shrink-0"
                    style={{ backgroundColor: t.status_color + '20', color: t.status_color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.status_color }} />
                    {t.status_name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: prio.color }}
                      title={`Prioridade: ${prio.label}`}
                    />
                    {due && (
                      <span
                        className={`text-[11px] font-medium tabular-nums ${
                          isOverdue ? 'text-[var(--danger)]' : 'text-secondary'
                        }`}
                      >
                        {due}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
