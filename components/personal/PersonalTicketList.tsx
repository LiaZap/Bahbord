'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Moon } from 'lucide-react';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
import EmptyState from '@/components/ui/EmptyState';
import { routes } from '@/lib/utils/nav';
import type { Route } from 'next';

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
  completed_at?: string | null;
  snoozed_until?: string | null;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  project_prefix: string | null;
  updated_at: string;
}

type DateFilter = 'all' | 'today' | 'week' | 'overdue';

interface PersonalTicketListProps {
  tickets: PersonalTicket[];
  emptyMessage?: string;
  groupBy?: 'project' | 'priority' | 'none';
  showFilters?: boolean;
  /** Quando true, indica que estamos na visão "Snoozed" (vem da URL). */
  showSnoozed?: boolean;
}

const FILTER_STORAGE_KEY = 'my-tasks-filter';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function matchesFilter(t: PersonalTicket, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  if (!t.due_date) return false; // sem due_date só aparece em "all"
  const due = new Date(t.due_date);
  if (Number.isNaN(due.getTime())) return false;
  const today = startOfToday();

  if (filter === 'today') {
    return isSameDay(due, today);
  }
  if (filter === 'overdue') {
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    return dueDay.getTime() < today.getTime() && !t.completed_at;
  }
  if (filter === 'week') {
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    // próximos 7 dias OU já passou (não concluído)
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    if (dueDay.getTime() < today.getTime()) return !t.completed_at;
    return dueDay.getTime() <= in7.getTime();
  }
  return true;
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
  emptyMessage,
  groupBy = 'project',
  showFilters = true,
  showSnoozed = false,
}: PersonalTicketListProps) {
  const tFilters = useTranslations('filters');
  const tTickets = useTranslations('tickets');
  const resolvedEmptyMessage = emptyMessage ?? tTickets('nothingHere');
  const [filter, setFilter] = useState<DateFilter>('all');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggleSnoozedView() {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (showSnoozed) {
      params.delete('show_snoozed');
    } else {
      params.set('show_snoozed', 'true');
    }
    const qs = params.toString();
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  // Hidrata filtro do localStorage no mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved === 'today' || saved === 'week' || saved === 'overdue' || saved === 'all') {
        setFilter(saved);
      }
    } catch {
      // localStorage indisponível — silencioso
    }
  }, []);

  // Persiste seleção
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, filter);
    } catch {
      // silencioso
    }
  }, [filter]);

  // Contadores por categoria — calculados do array completo (não filtrado)
  const counts = useMemo(() => ({
    all: tickets.length,
    today: tickets.filter((t) => matchesFilter(t, 'today')).length,
    week: tickets.filter((t) => matchesFilter(t, 'week')).length,
    overdue: tickets.filter((t) => matchesFilter(t, 'overdue')).length,
  }), [tickets]);

  // Tickets filtrados conforme chip ativo
  const filteredTickets = useMemo(
    () => tickets.filter((t) => matchesFilter(t, filter)),
    [tickets, filter]
  );

  const groups = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', tickets: filteredTickets, color: null }];
    }
    if (groupBy === 'priority') {
      const map = new Map<string, PersonalTicket[]>();
      for (const t of filteredTickets) {
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
    for (const t of filteredTickets) {
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
  }, [filteredTickets, groupBy]);

  const filterChips: { key: DateFilter; label: string }[] = [
    { key: 'today', label: tFilters('today') },
    { key: 'week', label: tFilters('week') },
    { key: 'overdue', label: tFilters('overdue') },
    { key: 'all', label: tFilters('all') },
  ];

  const filterBar = showFilters ? (
    <div className="flex flex-wrap items-center gap-2">
      {filterChips.map((c) => {
        const active = !showSnoozed && filter === c.key;
        const count = counts[c.key];
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              if (showSnoozed) {
                // Sair da view snoozed e aplicar o chip clicado
                const params = new URLSearchParams(searchParams?.toString() || '');
                params.delete('show_snoozed');
                const qs = params.toString();
                router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
              }
              setFilter(c.key);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              active
                ? 'bg-accent text-white'
                : 'surface-subtle text-secondary-muted hover:surface-hover hover:text-primary'
            }`}
            aria-pressed={active}
          >
            <span>{c.label}</span>
            <span className={`tabular-nums text-[11px] ${active ? 'text-white/80' : 'text-secondary-muted'}`}>
              ({count})
            </span>
          </button>
        );
      })}
      {/* Chip Snoozed — toggle URL ?show_snoozed=true */}
      <button
        type="button"
        onClick={toggleSnoozedView}
        aria-pressed={showSnoozed}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
          showSnoozed
            ? 'bg-indigo-500 text-white'
            : 'surface-subtle text-secondary-muted hover:surface-hover hover:text-primary'
        }`}
        title={showSnoozed ? tFilters('snoozedToggleOn') : tFilters('snoozedToggleOff')}
      >
        <Moon size={12} strokeWidth={2} />
        <span>{tFilters('snoozed')}</span>
      </button>
    </div>
  ) : null;

  // Sem tickets de jeito nenhum
  if (tickets.length === 0) {
    return (
      <div className="space-y-4">
        {filterBar}
        <div className="card-premium">
          <EmptyState
            illustration="all-done"
            title={showSnoozed ? tFilters('noSnoozedTickets') : tTickets('allDone')}
            description={resolvedEmptyMessage}
          />
        </div>
      </div>
    );
  }

  // Filtro ativo retorna 0
  if (filteredTickets.length === 0) {
    return (
      <div className="space-y-4">
        {filterBar}
        <div className="card-premium">
          <EmptyState
            illustration="no-results"
            title={tFilters('noResults')}
            description={tFilters('adjustFilters')}
            actions={[{ label: tFilters('viewAll'), onClick: () => setFilter('all'), variant: 'primary' }]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filterBar}
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
                  href={routes.ticket(t.id)}
                  className="grid grid-cols-[24px_64px_1fr_auto] sm:grid-cols-[24px_80px_1fr_auto_auto] items-center gap-2 sm:gap-3 border-b border-[var(--card-border)] px-3 sm:px-4 py-2.5 last:border-0 hover:bg-[var(--overlay-subtle)] transition-colors"
                >
                  <TicketTypeIcon typeName={t.type_name} typeIcon={t.type_icon} size="sm" />
                  <span className="font-mono text-[11px] font-bold text-secondary tabular-nums">{t.ticket_key}</span>
                  <span className="flex items-center gap-1.5 text-[13px] text-primary truncate min-w-0">
                    <span className="truncate">{t.title}</span>
                    {t.snoozed_until && new Date(t.snoozed_until).getTime() > Date.now() && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded px-1 py-[1px] text-[10px] font-medium bg-indigo-500/15 text-indigo-400 shrink-0"
                        title={`Snoozed até ${new Date(t.snoozed_until).toLocaleString('pt-BR')}`}
                      >
                        <Moon size={9} strokeWidth={2} />
                        {new Date(t.snoozed_until).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </span>
                  <span
                    className="hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium shrink-0"
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
    </div>
  );
}
