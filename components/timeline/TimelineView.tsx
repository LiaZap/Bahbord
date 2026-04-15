'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Check, Calendar, Filter } from 'lucide-react';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
import { cn } from '@/lib/utils/cn';

// ─── Types ───────────────────────────────────────────────────────────
interface TimelineTicket {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  type_icon: string;
  status_name: string;
  status_color: string;
  is_done: boolean;
  service_name: string | null;
  service_color: string | null;
  assignee_name: string | null;
  sprint_id: string | null;
  sprint_name: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Sprint {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_completed: boolean;
}

type ZoomLevel = 'week' | 'month' | 'quarter';

interface TimelineViewProps {
  tickets: TimelineTicket[];
  sprints: Sprint[];
}

// ─── Constants ───────────────────────────────────────────────────────
const SPRINT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#e11d48', // rose
];

const PRIORITY_DOTS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#60a5fa',
};

const ROW_HEIGHT = 40;
const LEFT_PANEL_WIDTH = 320;

// ─── Helpers ─────────────────────────────────────────────────────────
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getSprintColor(index: number): string {
  return SPRINT_COLORS[index % SPRINT_COLORS.length];
}

// ─── Component ───────────────────────────────────────────────────────
export default function TimelineView({ tickets, sprints }: TimelineViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [filterSprint, setFilterSprint] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const today = startOfDay(new Date());

  // Sprint color map
  const sprintColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    sprints.forEach((s, i) => {
      map[s.id] = getSprintColor(i);
    });
    return map;
  }, [sprints]);

  // Unique assignees and statuses for filters
  const assignees = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => t.assignee_name && set.add(t.assignee_name));
    return Array.from(set).sort();
  }, [tickets]);

  const statuses = useMemo(() => {
    const map = new Map<string, string>();
    tickets.forEach((t) => map.set(t.status_name, t.status_color));
    return Array.from(map.entries());
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filterSprint !== 'all' && t.sprint_id !== filterSprint) return false;
      if (filterAssignee !== 'all' && t.assignee_name !== filterAssignee) return false;
      if (filterStatus !== 'all' && t.status_name !== filterStatus) return false;
      return true;
    });
  }, [tickets, filterSprint, filterAssignee, filterStatus]);

  // Calculate timeline range
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    let minDate = today;
    let maxDate = addDays(today, 30);

    filteredTickets.forEach((t) => {
      const created = startOfDay(new Date(t.created_at));
      const end = t.due_date
        ? startOfDay(new Date(t.due_date))
        : t.completed_at
          ? startOfDay(new Date(t.completed_at))
          : addDays(created, 7);

      if (created < minDate) minDate = created;
      if (end > maxDate) maxDate = end;
    });

    // Also include sprint ranges
    sprints.forEach((s) => {
      if (s.start_date) {
        const sd = startOfDay(new Date(s.start_date));
        if (sd < minDate) minDate = sd;
      }
      if (s.end_date) {
        const ed = startOfDay(new Date(s.end_date));
        if (ed > maxDate) maxDate = ed;
      }
    });

    // Add padding
    const start = addDays(getMonday(minDate), -7);
    const end = addDays(maxDate, 14);
    const total = daysBetween(start, end);

    return { timelineStart: start, timelineEnd: end, totalDays: Math.max(total, 30) };
  }, [filteredTickets, sprints, today]);

  // Column width per day based on zoom
  const dayWidth = useMemo(() => {
    switch (zoom) {
      case 'week': return 32;
      case 'month': return 12;
      case 'quarter': return 4;
    }
  }, [zoom]);

  const gridWidth = totalDays * dayWidth;

  // Generate time columns (week headers)
  const timeColumns = useMemo(() => {
    const cols: { label: string; left: number; width: number; isMonth: boolean }[] = [];

    if (zoom === 'week') {
      // Show weeks with day-level granularity
      let current = new Date(timelineStart);
      while (current < timelineEnd) {
        const weekStart = getMonday(current);
        const weekEnd = addDays(weekStart, 6);
        const left = daysBetween(timelineStart, weekStart) * dayWidth;
        const width = 7 * dayWidth;
        cols.push({
          label: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
          left: Math.max(left, 0),
          width,
          isMonth: false,
        });
        current = addDays(weekStart, 7);
      }
    } else if (zoom === 'month') {
      let current = new Date(timelineStart);
      while (current < timelineEnd) {
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        const left = daysBetween(timelineStart, monthStart) * dayWidth;
        const daysInMonth = monthEnd.getDate();
        cols.push({
          label: monthStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
          left: Math.max(left, 0),
          width: daysInMonth * dayWidth,
          isMonth: true,
        });
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    } else {
      // Quarter
      let current = new Date(timelineStart);
      while (current < timelineEnd) {
        const q = Math.floor(current.getMonth() / 3);
        const qStart = new Date(current.getFullYear(), q * 3, 1);
        const qEnd = new Date(current.getFullYear(), q * 3 + 3, 0);
        const left = daysBetween(timelineStart, qStart) * dayWidth;
        const daysInQ = daysBetween(qStart, addDays(qEnd, 1));
        cols.push({
          label: `T${q + 1} ${current.getFullYear()}`,
          left: Math.max(left, 0),
          width: daysInQ * dayWidth,
          isMonth: true,
        });
        current = new Date(current.getFullYear(), q * 3 + 3, 1);
      }
    }

    return cols;
  }, [timelineStart, timelineEnd, dayWidth, zoom]);

  // Sprint bands for background
  const sprintBands = useMemo(() => {
    return sprints
      .filter((s) => s.start_date && s.end_date)
      .map((s, i) => {
        const start = startOfDay(new Date(s.start_date!));
        const end = startOfDay(new Date(s.end_date!));
        const left = daysBetween(timelineStart, start) * dayWidth;
        const width = daysBetween(start, end) * dayWidth;
        return {
          id: s.id,
          name: s.name,
          left,
          width: Math.max(width, dayWidth),
          color: getSprintColor(i),
          isActive: s.is_active,
        };
      });
  }, [sprints, timelineStart, dayWidth]);

  // Today marker position
  const todayLeft = daysBetween(timelineStart, today) * dayWidth;

  // Scroll to today
  const scrollToToday = useCallback(() => {
    if (gridRef.current) {
      const scrollTarget = todayLeft - gridRef.current.clientWidth / 2;
      gridRef.current.scrollTo({ left: Math.max(scrollTarget, 0), behavior: 'smooth' });
    }
  }, [todayLeft]);

  useEffect(() => {
    // Scroll to today on mount
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [scrollToToday]);

  // Calculate bar for a ticket
  function getTicketBar(ticket: TimelineTicket) {
    const created = startOfDay(new Date(ticket.created_at));
    const endDate = ticket.completed_at
      ? startOfDay(new Date(ticket.completed_at))
      : ticket.due_date
        ? startOfDay(new Date(ticket.due_date))
        : null;

    const barStart = created;
    const barEnd = endDate ? endDate : addDays(created, 7); // default 7 days if no end

    const left = daysBetween(timelineStart, barStart) * dayWidth;
    const width = Math.max(daysBetween(barStart, barEnd) * dayWidth, dayWidth * 2); // min 2 days width

    const color = ticket.sprint_id
      ? sprintColorMap[ticket.sprint_id] || '#6b7280'
      : '#6b7280';

    const isOverdue =
      !ticket.is_done &&
      ticket.due_date &&
      startOfDay(new Date(ticket.due_date)) < today;

    const noDueDate = !ticket.due_date;

    return { left, width, color, isOverdue, noDueDate, isDone: ticket.is_done };
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between border-b border-border/40 bg-surface2 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">Cronograma</h1>
          <span className="text-xs text-slate-500">
            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center rounded border border-border/40 bg-surface">
            {(['week', 'month', 'quarter'] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium transition',
                  zoom === z
                    ? 'bg-accent/20 text-accent'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {z === 'week' ? 'Semana' : z === 'month' ? 'Mes' : 'Trimestre'}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition',
              showFilters ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:bg-surface hover:text-white'
            )}
          >
            <Filter size={13} />
            Filtros
          </button>

          {/* Today button */}
          <button
            onClick={scrollToToday}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-surface hover:text-white"
          >
            <Calendar size={13} />
            Hoje
          </button>

          {/* Nav arrows */}
          <button
            onClick={() => {
              if (gridRef.current) {
                gridRef.current.scrollBy({ left: -dayWidth * 7, behavior: 'smooth' });
              }
            }}
            className="rounded p-1 text-slate-400 transition hover:bg-surface hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              if (gridRef.current) {
                gridRef.current.scrollBy({ left: dayWidth * 7, behavior: 'smooth' });
              }
            }}
            className="rounded p-1 text-slate-400 transition hover:bg-surface hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Filters row ── */}
      {showFilters && (
        <div className="flex items-center gap-3 border-b border-border/40 bg-surface2/50 px-4 py-2">
          {/* Sprint filter */}
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            Sprint:
            <select
              value={filterSprint}
              onChange={(e) => setFilterSprint(e.target.value)}
              className="rounded border border-border/40 bg-surface px-2 py-0.5 text-[11px] text-slate-300 outline-none"
            >
              <option value="all">Todos</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {/* Assignee filter */}
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            Responsavel:
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="rounded border border-border/40 bg-surface px-2 py-0.5 text-[11px] text-slate-300 outline-none"
            >
              <option value="all">Todos</option>
              {assignees.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          {/* Status filter */}
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            Status:
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded border border-border/40 bg-surface px-2 py-0.5 text-[11px] text-slate-300 outline-none"
            >
              <option value="all">Todos</option>
              {statuses.map(([name]) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* ── Sprint legend ── */}
      {sprints.length > 0 && (
        <div className="flex items-center gap-4 border-b border-border/30 bg-surface px-4 py-1.5">
          {sprints.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: getSprintColor(i) }}
              />
              <span className={cn(
                'text-[11px]',
                s.is_active ? 'font-medium text-white' : 'text-slate-500'
              )}>
                {s.name}
                {s.is_active && ' (ativo)'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Main gantt area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - ticket list */}
        <div
          className="flex-shrink-0 border-r border-border/40 bg-surface"
          style={{ width: LEFT_PANEL_WIDTH }}
        >
          {/* Left header */}
          <div className="flex h-[52px] items-center border-b border-border/40 bg-surface2 px-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ticket
            </span>
          </div>

          {/* Ticket rows */}
          <div className="overflow-y-auto" style={{ height: `calc(100% - 52px)` }}>
            {filteredTickets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 border-b border-border/20 px-3 transition hover:bg-surface2/50"
                style={{ height: ROW_HEIGHT }}
              >
                {/* Priority dot */}
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: PRIORITY_DOTS[t.priority] || '#eab308' }}
                  title={t.priority}
                />

                {/* Type icon */}
                <TicketTypeIcon typeIcon={t.type_icon} size="sm" showBackground={false} />

                {/* Key */}
                <Link
                  href={`/ticket/${t.id}`}
                  className="flex-shrink-0 font-mono text-[10px] text-slate-500 transition hover:text-accent"
                >
                  {t.ticket_key}
                </Link>

                {/* Title */}
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={t.title}>
                  {t.title}
                </span>

                {/* Status badge */}
                <span
                  className="flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-medium"
                  style={{
                    backgroundColor: t.status_color + '20',
                    color: t.status_color,
                  }}
                >
                  {t.status_name}
                </span>

                {/* Assignee avatar (initials) */}
                {t.assignee_name && (
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent"
                    title={t.assignee_name}
                  >
                    {t.assignee_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {filteredTickets.length === 0 && (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                Nenhum ticket encontrado
              </div>
            )}
          </div>
        </div>

        {/* Right panel - gantt grid */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={gridRef}
            className="h-full overflow-auto"
          >
            <div style={{ width: gridWidth, minHeight: '100%' }} className="relative">
              {/* ── Time header ── */}
              <div
                className="sticky top-0 z-20 border-b border-border/40 bg-surface2"
                style={{ height: 52 }}
              >
                {/* Sprint bands in header */}
                {sprintBands.map((band) => (
                  <div
                    key={band.id}
                    className="absolute top-0 flex items-center justify-center overflow-hidden text-[10px] font-semibold"
                    style={{
                      left: band.left,
                      width: band.width,
                      height: 22,
                      backgroundColor: band.color + '25',
                      color: band.color,
                      borderBottom: `2px solid ${band.color}`,
                    }}
                  >
                    {band.name}
                  </div>
                ))}

                {/* Time columns */}
                {timeColumns.map((col, i) => (
                  <div
                    key={i}
                    className="absolute bottom-0 flex items-center justify-center border-r border-border/20 text-[10px] text-slate-500"
                    style={{
                      left: col.left,
                      width: col.width,
                      height: 28,
                    }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>

              {/* ── Grid body ── */}
              <div className="relative" style={{ paddingTop: 0 }}>
                {/* Vertical grid lines */}
                {timeColumns.map((col, i) => (
                  <div
                    key={`vl-${i}`}
                    className="absolute top-0 bottom-0 border-r border-border/10"
                    style={{ left: col.left + col.width }}
                  />
                ))}

                {/* Sprint background bands */}
                {sprintBands.map((band) => (
                  <div
                    key={`sb-${band.id}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: band.left,
                      width: band.width,
                      backgroundColor: band.color + '06',
                    }}
                  />
                ))}

                {/* Today line */}
                <div
                  ref={todayRef}
                  className="absolute top-0 bottom-0 z-10"
                  style={{
                    left: todayLeft,
                    width: 2,
                    backgroundColor: '#ef4444',
                  }}
                >
                  <div className="absolute -top-0 -left-[3px] h-2 w-2 rounded-full bg-red-500" />
                </div>

                {/* Ticket bars */}
                {filteredTickets.map((ticket, rowIdx) => {
                  const bar = getTicketBar(ticket);

                  return (
                    <div
                      key={ticket.id}
                      className="relative border-b border-border/10"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Weekend shading - only in week zoom */}
                      {zoom === 'week' &&
                        Array.from({ length: totalDays }).map((_, d) => {
                          const date = addDays(timelineStart, d);
                          const dow = date.getDay();
                          if (dow !== 0 && dow !== 6) return null;
                          return (
                            <div
                              key={d}
                              className="absolute top-0 bottom-0 bg-white/[0.02]"
                              style={{ left: d * dayWidth, width: dayWidth }}
                            />
                          );
                        })}

                      {/* Bar */}
                      <Link
                        href={`/ticket/${ticket.id}`}
                        className="group absolute flex items-center gap-1 overflow-hidden rounded-sm transition-all hover:brightness-125 hover:shadow-lg"
                        style={{
                          left: bar.left,
                          width: bar.width,
                          top: 8,
                          height: ROW_HEIGHT - 16,
                          backgroundColor: bar.isDone
                            ? '#22c55e'
                            : bar.color,
                          opacity: bar.isDone ? 0.8 : 0.85,
                          border: bar.isOverdue
                            ? '2px solid #ef4444'
                            : bar.noDueDate
                              ? '1px dashed rgba(255,255,255,0.3)'
                              : 'none',
                          borderRadius: 4,
                        }}
                      >
                        {/* Done checkmark */}
                        {bar.isDone && (
                          <Check size={10} className="ml-1 flex-shrink-0 text-white" />
                        )}

                        {/* Bar label */}
                        <span className="truncate px-1.5 text-[10px] font-medium text-white">
                          {ticket.ticket_key} {ticket.title}
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
