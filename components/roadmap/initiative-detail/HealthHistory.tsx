'use client';

import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { HEALTH_BADGE, HEALTH_LABELS, asHealth, formatDate, formatDateTime, isHealth } from './shared';
import type { DetailHealthEvent } from './types';

interface SidebarProps {
  description: string | null;
  ownerName: string | null;
  startDate: string | null;
  targetDate: string | null;
  healthNote: string | null;
  healthSetByName: string | null;
  healthSetAt: string | null;
  history: DetailHealthEvent[];
}

/** Coluna direita: descrição, detalhes (owner/datas), nota e histórico de health. */
export default function HealthHistory({
  description,
  ownerName,
  startDate,
  targetDate,
  healthNote,
  healthSetByName,
  healthSetAt,
  history,
}: SidebarProps): JSX.Element {
  return (
    <aside className="space-y-4">
      {description && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
            Descrição
          </h3>
          <p className="text-[12.5px] leading-relaxed text-secondary-muted whitespace-pre-line">
            {description}
          </p>
        </div>
      )}

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 text-[12.5px]">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
          Detalhes
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-tertiary-muted">Owner</span>
          <span className="text-primary">{ownerName ?? 'Sem owner'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-tertiary-muted">Início</span>
          <span className="text-primary">{formatDate(startDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-tertiary-muted">Prazo</span>
          <span className="inline-flex items-center gap-1 text-primary">
            <CalendarClock size={11} className="text-tertiary-muted" />
            {formatDate(targetDate)}
          </span>
        </div>
      </div>

      {healthNote && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
            Nota do health
          </h3>
          <p className="text-[12.5px] leading-relaxed text-secondary-muted">{healthNote}</p>
          {healthSetByName && healthSetAt && (
            <p className="mt-2 text-[11px] text-tertiary-muted">
              Por {healthSetByName} em {formatDateTime(healthSetAt)}
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
          Histórico de health
        </h3>
        {history.length === 0 ? (
          <p className="text-[12px] text-tertiary-muted">Sem mudanças registradas.</p>
        ) : (
          <ul className="space-y-2.5 text-[12px]">
            {history.map((ev, idx) => {
              const fromKey = ev.from && isHealth(ev.from) ? asHealth(ev.from) : null;
              const toKey = ev.to && isHealth(ev.to) ? asHealth(ev.to) : null;
              return (
                <li key={`${ev.created_at}-${idx}`} className="leading-snug">
                  <div className="flex items-center gap-1.5">
                    {fromKey && (
                      <span className={cn('badge border', HEALTH_BADGE[fromKey])}>
                        {HEALTH_LABELS[fromKey]}
                      </span>
                    )}
                    <span className="text-tertiary-muted">→</span>
                    {toKey && (
                      <span className={cn('badge border', HEALTH_BADGE[toKey])}>
                        {HEALTH_LABELS[toKey]}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-tertiary-muted">
                    {ev.actor_name ?? 'Sistema'} · {formatDateTime(ev.created_at)}
                  </p>
                  {ev.note && (
                    <p className="mt-0.5 text-secondary-muted italic">&quot;{ev.note}&quot;</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
