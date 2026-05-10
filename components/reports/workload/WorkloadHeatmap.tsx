'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Tooltip from '@/components/ui/Tooltip';
import { getInitials, colorFromName } from '@/lib/utils/avatar';
import {
  cellClasses,
  formatLoad,
  formatTotalHours,
  formatWeekHeader,
} from './format';
import {
  MINUTES_PER_WEEK,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  type CellSelection,
  type WorkloadMember,
  type WorkloadResponse,
  type WorkloadWeek,
} from './types';

export function HeatmapSkeleton(): JSX.Element {
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

export function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-3 w-5 rounded-sm border', className)} />
      <span>{label}</span>
    </span>
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
        !interactive && 'cursor-default',
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

export function CellDetail({ selection }: { selection: CellSelection }): JSX.Element {
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

export default function WorkloadHeatmap({
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
                      style={{ backgroundColor: colorFromName(member.display_name) }}
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
