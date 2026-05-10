'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Tooltip from '@/components/ui/Tooltip';
import { useToast } from '@/components/ui/Toast';

// ----------------------------------------------------------------------------
// Types (mirror /api/reports/workload response)
// ----------------------------------------------------------------------------

interface WorkloadProject {
  id: string;
  name: string;
  color: string | null;
}

interface WorkloadTicket {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  due_date: string | null;
  estimate_minutes: number;
}

interface WorkloadWeek {
  week_start: string;
  week_end: string;
  ticket_count: number;
  estimate_minutes: number;
  tickets: WorkloadTicket[];
}

interface WorkloadMember {
  member_id: string;
  display_name: string;
  avatar_url: string | null;
  weeks: WorkloadWeek[];
  total_minutes: number;
  total_tickets: number;
}

interface WorkloadResponse {
  period: { from: string; to: string };
  members: WorkloadMember[];
}

interface MeData {
  id: string;
  display_name: string;
  role: string;
}

interface WorkloadViewProps {
  projects: WorkloadProject[];
}

interface CellSelection {
  member: WorkloadMember;
  week: WorkloadWeek;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const MINUTES_PER_DAY = 8 * 60; // 8h workday
const MINUTES_PER_WEEK = 5 * MINUTES_PER_DAY; // 40h

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  // hoje + 4 semanas (28 dias)
  const today = isoToday();
  return { from: today, to: addDaysISO(today, 27) };
}

/**
 * Format minutes as a compact load label.
 * - 0  -> '—'
 * - <60min -> 'Xm'
 * - <8h    -> 'Xh' (rounded to 0.5h)
 * - >=8h   -> 'Xd' (1 day = 8h)
 */
function formatLoad(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 8) {
    const rounded = Math.round(hours * 2) / 2;
    return `${rounded}h`;
  }
  const days = hours / 8;
  const roundedDays = Math.round(days * 10) / 10;
  return `${roundedDays}d`;
}

function formatTotalHours(minutes: number): string {
  if (minutes <= 0) return '0h';
  const hours = minutes / 60;
  if (hours < 10) {
    return `${Math.round(hours * 10) / 10}h`;
  }
  return `${Math.round(hours)}h`;
}

function formatWeekHeader(weekStart: string, weekEnd: string): { line1: string; line2: string } {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(weekEnd + 'T00:00:00Z');
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const startMonth = months[start.getUTCMonth()];
  const endMonth = months[end.getUTCMonth()];
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const line2 = sameMonth
    ? `${startDay}–${endDay} ${startMonth}`
    : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  // ISO week number
  const weekNumber = isoWeekNumber(start);
  return { line1: `Sem. ${weekNumber}`, line2 };
}

function isoWeekNumber(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/**
 * Heatmap colour buckets (semantic):
 *   0          -> empty / no load   (overlay-subtle)
 *   1..240     -> light green       (até 4h ≈ meio dia leve)
 *   241..1200  -> medium green      (4h–20h, semana metade)
 *   1201..2400 -> amber             (20h–40h, semana cheia)
 *   2400+      -> red               (overcapacity, sobrecarga)
 *
 * Uses tailwind colours that hold up in both light and dark mode.
 */
function cellClasses(minutes: number): {
  bg: string;
  text: string;
  border: string;
  level: 'empty' | 'light' | 'medium' | 'heavy' | 'over';
} {
  if (minutes <= 0) {
    return {
      bg: 'bg-[var(--overlay-subtle)]',
      text: 'text-tertiary-muted',
      border: 'border-[var(--card-border)]',
      level: 'empty',
    };
  }
  if (minutes <= 240) {
    return {
      bg: 'bg-emerald-500/15 dark:bg-emerald-500/15',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-500/25',
      level: 'light',
    };
  }
  if (minutes <= 1200) {
    return {
      bg: 'bg-emerald-500/35 dark:bg-emerald-500/30',
      text: 'text-emerald-800 dark:text-emerald-200',
      border: 'border-emerald-500/40',
      level: 'medium',
    };
  }
  if (minutes <= 2400) {
    return {
      bg: 'bg-amber-500/30 dark:bg-amber-500/25',
      text: 'text-amber-800 dark:text-amber-200',
      border: 'border-amber-500/40',
      level: 'heavy',
    };
  }
  return {
    bg: 'bg-rose-500/35 dark:bg-rose-500/30',
    text: 'text-rose-800 dark:text-rose-200',
    border: 'border-rose-500/45',
    level: 'over',
  };
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-sky-500',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function colourFromName(name: string): string {
  const palette = ['#3b6cf5', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export default function WorkloadView({ projects }: WorkloadViewProps): JSX.Element {
  const initial = useMemo(defaultRange, []);
  const [draftFrom, setDraftFrom] = useState<string>(initial.from);
  const [draftTo, setDraftTo] = useState<string>(initial.to);
  const [appliedFrom, setAppliedFrom] = useState<string>(initial.from);
  const [appliedTo, setAppliedTo] = useState<string>(initial.to);
  const [projectId, setProjectId] = useState<string>('');
  const [onlyMe, setOnlyMe] = useState<boolean>(false);
  const [me, setMe] = useState<MeData | null>(null);
  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellSelection | null>(null);
  const { toast } = useToast();

  // Load `me` once for "apenas eu" toggle
  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.member) setMe(json.member as MeData);
      } catch {
        /* silent */
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('period_from', appliedFrom);
    sp.set('period_to', appliedTo);
    if (projectId) sp.set('project_id', projectId);
    if (onlyMe && me?.id) sp.set('member_ids', me.id);
    return sp.toString();
  }, [appliedFrom, appliedTo, projectId, onlyMe, me?.id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/workload?${queryString}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || `Erro ${res.status} ao carregar carga`;
        setError(msg);
        toast(msg, 'error');
        setData(null);
        return;
      }
      const json = (await res.json()) as WorkloadResponse;
      setData(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar carga de trabalho';
      setError(msg);
      toast(msg, 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function applyDates() {
    if (!draftFrom || !draftTo) {
      toast('Informe as duas datas do período.', 'warning');
      return;
    }
    if (draftFrom > draftTo) {
      toast('A data inicial deve ser anterior à final.', 'warning');
      return;
    }
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
  }

  // ---- Derived: weekly totals (footer) ----
  const weeksTemplate = useMemo<Array<{ week_start: string; week_end: string }>>(() => {
    if (data?.members?.[0]?.weeks?.length) {
      return data.members[0].weeks.map((w) => ({ week_start: w.week_start, week_end: w.week_end }));
    }
    return [];
  }, [data]);

  const weeklyTotals = useMemo<number[]>(() => {
    if (!data || weeksTemplate.length === 0) return [];
    return weeksTemplate.map((_, idx) =>
      data.members.reduce((sum, m) => sum + (m.weeks[idx]?.estimate_minutes ?? 0), 0)
    );
  }, [data, weeksTemplate]);

  const grandTotal = useMemo<number>(
    () => (data ? data.members.reduce((s, m) => s + m.total_minutes, 0) : 0),
    [data]
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
            <BarChart3 size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Carga de trabalho</h1>
            <p className="mt-1 text-sm text-secondary-muted">
              Distribuição por pessoa nas próximas semanas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-xs font-medium text-primary transition',
            'hover:bg-[var(--overlay-hover)] disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Atualizar"
        >
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-5">
        <h2 className="mb-4 text-sm font-semibold text-primary">Filtros</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary-muted" htmlFor="wl-from">
              De
            </label>
            <input
              id="wl-from"
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="w-full rounded border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary-muted" htmlFor="wl-to">
              Até
            </label>
            <input
              id="wl-to"
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="w-full rounded border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary-muted" htmlFor="wl-project">
              Projeto
            </label>
            <select
              id="wl-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
            >
              <option value="">Todos os projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center gap-2 rounded border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-primary transition hover:bg-[var(--overlay-hover)]">
              <input
                type="checkbox"
                checked={onlyMe}
                onChange={(e) => setOnlyMe(e.target.checked)}
                disabled={!me}
                className="h-3.5 w-3.5 rounded border-[var(--card-border)] accent-[var(--accent)]"
              />
              <span className="text-xs">Apenas eu</span>
            </label>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyDates}
              className="w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap or skeleton or empty */}
      {loading ? (
        <HeatmapSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-rose-500">Não consegui carregar a carga</p>
              <p className="mt-1 text-xs text-secondary-muted">{error}</p>
            </div>
          </div>
        </div>
      ) : !data || data.members.length === 0 ? (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
          <EmptyState
            illustration="no-activity"
            title="Sem dados de carga"
            description="Ninguém com tickets atribuídos no período e filtros selecionados. Ajuste o intervalo ou o projeto."
          />
        </div>
      ) : (
        <Heatmap
          data={data}
          weeksTemplate={weeksTemplate}
          weeklyTotals={weeklyTotals}
          grandTotal={grandTotal}
          onCellClick={(member, week) => {
            if (week.tickets.length > 0) setSelectedCell({ member, week });
          }}
        />
      )}

      {/* Legend */}
      {!loading && data && data.members.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary-muted">
          <span className="font-medium uppercase tracking-wider">Legenda:</span>
          <LegendSwatch className="bg-[var(--overlay-subtle)] border-[var(--card-border)]" label="Sem carga" />
          <LegendSwatch className="bg-emerald-500/15 border-emerald-500/25" label="Até 4h" />
          <LegendSwatch className="bg-emerald-500/35 border-emerald-500/40" label="4–20h" />
          <LegendSwatch className="bg-amber-500/30 border-amber-500/40" label="20–40h" />
          <LegendSwatch className="bg-rose-500/35 border-rose-500/45" label="Sobrecarga (>40h)" />
        </div>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={selectedCell !== null}
        onClose={() => setSelectedCell(null)}
        title={
          selectedCell
            ? `${selectedCell.member.display_name} · ${formatTotalHours(selectedCell.week.estimate_minutes)}`
            : ''
        }
        maxWidth="max-w-2xl"
      >
        {selectedCell && <CellDetail selection={selectedCell} />}
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function Heatmap({
  data,
  weeksTemplate,
  weeklyTotals,
  grandTotal,
  onCellClick,
}: {
  data: WorkloadResponse;
  weeksTemplate: Array<{ week_start: string; week_end: string }>;
  weeklyTotals: number[];
  grandTotal: number;
  onCellClick: (member: WorkloadMember, week: WorkloadWeek) => void;
}): JSX.Element {
  const colCount = weeksTemplate.length;

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            <th className="sticky left-0 z-10 min-w-[200px] bg-[var(--card-bg)] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">
              Pessoa
            </th>
            {weeksTemplate.map((w) => {
              const h = formatWeekHeader(w.week_start, w.week_end);
              return (
                <th
                  key={w.week_start}
                  className="min-w-[110px] px-2 py-3 text-center text-[11px] font-semibold text-secondary-muted"
                >
                  <div className="leading-tight">
                    <div className="text-primary">{h.line1}</div>
                    <div className="mt-0.5 text-[10px] font-normal text-tertiary-muted">{h.line2}</div>
                  </div>
                </th>
              );
            })}
            <th className="min-w-[100px] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.members.map((member) => (
            <tr key={member.member_id} className="border-b border-[var(--card-border)] last:border-b-0">
              <td className="sticky left-0 z-10 bg-[var(--card-bg)] px-4 py-2">
                <div className="flex items-center gap-2.5">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.avatar_url}
                      alt={member.display_name}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: colourFromName(member.display_name) }}
                    >
                      {getInitials(member.display_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-primary">
                      {member.display_name}
                    </div>
                    <div className="text-[10.5px] text-tertiary-muted">
                      {member.total_tickets} ticket{member.total_tickets === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              </td>
              {member.weeks.map((week) => (
                <HeatCell
                  key={`${member.member_id}-${week.week_start}`}
                  member={member}
                  week={week}
                  onClick={() => onCellClick(member, week)}
                />
              ))}
              <td className="px-3 py-2 text-right text-[12px] font-semibold tabular-nums text-primary">
                {formatTotalHours(member.total_minutes)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--card-border)] bg-[var(--overlay-subtle)]">
            <td className="sticky left-0 z-10 bg-[var(--overlay-subtle)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">
              Total semana
            </td>
            {Array.from({ length: colCount }).map((_, idx) => (
              <td
                key={idx}
                className="px-2 py-2.5 text-center text-[12px] font-semibold tabular-nums text-primary"
              >
                {formatTotalHours(weeklyTotals[idx] ?? 0)}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right text-[12px] font-bold tabular-nums text-primary">
              {formatTotalHours(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function HeatCell({
  member,
  week,
  onClick,
}: {
  member: WorkloadMember;
  week: WorkloadWeek;
  onClick: () => void;
}): JSX.Element {
  const cls = cellClasses(week.estimate_minutes);
  const label = formatLoad(week.estimate_minutes);
  const interactive = week.tickets.length > 0;

  const tooltipContent = (
    <div className="max-w-[260px] space-y-1.5">
      <div className="text-[11px] font-semibold text-primary">
        {member.display_name} · {formatTotalHours(week.estimate_minutes)}
      </div>
      {week.tickets.length === 0 ? (
        <div className="text-[11px] text-secondary-muted">Sem tickets nesta semana.</div>
      ) : (
        <>
          <div className="text-[10.5px] text-tertiary-muted">
            {week.ticket_count} ticket{week.ticket_count === 1 ? '' : 's'}
          </div>
          <ul className="space-y-0.5">
            {week.tickets.slice(0, 5).map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-1.5 text-[11px] text-secondary"
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[t.priority] ?? 'bg-slate-400')} />
                <span className="font-mono text-tertiary-muted">{t.ticket_key}</span>
                <span className="truncate">{t.title}</span>
              </li>
            ))}
            {week.tickets.length > 5 && (
              <li className="text-[10.5px] text-tertiary-muted">
                +{week.tickets.length - 5} ticket{week.tickets.length - 5 === 1 ? '' : 's'}…
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );

  const cellInner = (
    <div
      className={cn(
        'mx-1 flex h-12 flex-col items-center justify-center rounded border text-[12px] font-semibold tabular-nums transition',
        cls.bg,
        cls.text,
        cls.border,
        interactive && 'cursor-pointer hover:brightness-110 hover:scale-[1.02]',
        !interactive && 'cursor-default'
      )}
      onClick={interactive ? onClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={`${member.display_name}, semana ${week.week_start}: ${label}, ${week.ticket_count} tickets`}
    >
      <span>{label}</span>
      {week.ticket_count > 0 && (
        <span className="text-[9px] font-normal opacity-75">
          {week.ticket_count}
          {week.ticket_count === 1 ? ' ticket' : ' tickets'}
        </span>
      )}
    </div>
  );

  return (
    <td className="px-0 py-1">
      <Tooltip content={tooltipContent} side="top">
        {cellInner}
      </Tooltip>
    </td>
  );
}

function CellDetail({ selection }: { selection: CellSelection }): JSX.Element {
  const { week } = selection;
  const overCapacity = week.estimate_minutes > MINUTES_PER_WEEK;

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-tertiary-muted">
            Semana de {selection.week.week_start} a {selection.week.week_end}
          </div>
          <div className="mt-1 text-sm text-secondary">
            {week.ticket_count} ticket{week.ticket_count === 1 ? '' : 's'} ·{' '}
            <span className={cn('font-semibold', overCapacity ? 'text-rose-500' : 'text-primary')}>
              {formatTotalHours(week.estimate_minutes)}
            </span>
          </div>
        </div>
        {overCapacity && (
          <div className="flex items-center gap-1 rounded bg-rose-500/15 px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
            <AlertTriangle size={12} />
            Sobrecarga
          </div>
        )}
      </div>

      <div className="divide-y divide-[var(--card-border)] rounded-md border border-[var(--card-border)]">
        {week.tickets.map((t) => (
          <Link
            key={t.id}
            href={`/ticket/${t.id}`}
            className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-[var(--overlay-hover)]"
          >
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[t.priority] ?? 'bg-slate-400')}
              aria-hidden="true"
            />
            <span className="w-20 shrink-0 font-mono text-[11px] text-tertiary-muted">
              {t.ticket_key}
            </span>
            <span className="flex-1 truncate text-[13px] text-primary">{t.title}</span>
            <span className="hidden text-[11px] text-secondary-muted sm:inline">
              {PRIORITY_LABEL[t.priority] ?? t.priority}
            </span>
            {t.due_date && (
              <span className="hidden text-[11px] text-tertiary-muted md:inline">
                {t.due_date}
              </span>
            )}
            <ExternalLink size={12} className="shrink-0 text-tertiary-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function HeatmapSkeleton(): JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-3">
            <div className="flex w-[200px] shrink-0 items-center gap-2.5">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--overlay-subtle)]" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--overlay-subtle)]" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-[var(--overlay-subtle)]" />
              </div>
            </div>
            <div className="flex flex-1 gap-1.5">
              {Array.from({ length: 5 }).map((_, cellIdx) => (
                <div
                  key={cellIdx}
                  className="h-12 flex-1 animate-pulse rounded bg-[var(--overlay-subtle)]"
                  style={{ animationDelay: `${(rowIdx + cellIdx) * 50}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-3 w-5 rounded-sm border', className)} />
      <span>{label}</span>
    </span>
  );
}
