'use client';

import { useRouter } from 'next/navigation';
import {
  Pencil,
  Trash2,
  Target,
  Rocket,
  TrendingUp,
  Star,
  Flag,
  Trophy,
  Sparkles,
  Zap,
  CalendarClock,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getInitials, colorFromName } from '@/lib/utils/avatar';
import { routes } from '@/lib/utils/nav';
import type { Route } from 'next';
import type { HealthStatus, RoadmapInitiative } from './RoadmapView';

const HEALTH_LABELS: Record<HealthStatus, string> = {
  on_track: 'No prazo',
  at_risk: 'Em risco',
  off_track: 'Atrasado',
  completed: 'Concluído',
  archived: 'Arquivado',
};

const HEALTH_BADGE: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  at_risk: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  off_track: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  archived: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
};

const HEALTH_BAR: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-red-500',
  completed: 'bg-blue-500',
  archived: 'bg-zinc-500',
};

const ICON_MAP: Record<string, typeof Target> = {
  target: Target,
  rocket: Rocket,
  'trending-up': TrendingUp,
  star: Star,
  flag: Flag,
  trophy: Trophy,
  sparkles: Sparkles,
  zap: Zap,
};

export function isHealthStatus(value: string): value is HealthStatus {
  return (
    value === 'on_track' ||
    value === 'at_risk' ||
    value === 'off_track' ||
    value === 'completed' ||
    value === 'archived'
  );
}

export function asHealth(value: string): HealthStatus {
  return isHealthStatus(value) ? value : 'on_track';
}

export function relativeDate(target: string | null): string | null {
  if (!target) return null;
  const t = new Date(target);
  if (isNaN(t.getTime())) return null;
  const now = new Date();
  const ms = t.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'vence hoje';
  if (days > 0) {
    if (days === 1) return 'vence amanhã';
    if (days < 30) return `vence em ${days} dias`;
    if (days < 365) {
      const months = Math.round(days / 30);
      return months === 1 ? 'vence em 1 mês' : `vence em ${months} meses`;
    }
    return `vence em ${Math.round(days / 365)} ano(s)`;
  }
  const past = -days;
  if (past === 1) return 'atrasou há 1 dia';
  if (past < 30) return `atrasou há ${past} dias`;
  if (past < 365) {
    const months = Math.round(past / 30);
    return months === 1 ? 'atrasou há 1 mês' : `atrasou há ${months} meses`;
  }
  return `atrasou há ${Math.round(past / 365)} ano(s)`;
}

export function renderIcon(iconKey: string | null, size = 16): JSX.Element {
  if (!iconKey) return <Target size={size} />;
  const Comp = ICON_MAP[iconKey.toLowerCase()];
  if (Comp) return <Comp size={size} />;
  // Provavelmente é um emoji — renderiza como texto
  return <span className="text-[15px] leading-none">{iconKey}</span>;
}

interface InitiativeCardProps {
  initiative: RoadmapInitiative;
  isAdmin: boolean;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Card de uma iniciativa na lista do RoadmapView. Renderiza header, progresso,
 * pills de projetos vinculados e footer com prazo + owner.
 */
export default function InitiativeCard({
  initiative,
  isAdmin,
  editable,
  onEdit,
  onDelete,
}: InitiativeCardProps): JSX.Element {
  const router = useRouter();
  const health = asHealth(initiative.health);
  const rel = relativeDate(initiative.target_date);

  return (
    <div
      onClick={() => router.push(routes.initiative(initiative.id))}
      className="card-premium group cursor-pointer p-5 transition"
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: initiative.color ?? '#3b6cf5' }}
        >
          {renderIcon(initiative.icon, 18)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-primary truncate">{initiative.name}</h3>
            <span className={cn('badge border', HEALTH_BADGE[health])}>{HEALTH_LABELS[health]}</span>
          </div>
          {(initiative.goal || initiative.description) && (
            <p className="mt-1 line-clamp-2 text-[12.5px] text-secondary-muted">
              {initiative.goal ?? initiative.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          {editable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="rounded p-1.5 text-tertiary-muted transition hover:text-[var(--accent)]"
              title="Editar"
              aria-label="Editar iniciativa"
            >
              <Pencil size={14} />
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded p-1.5 text-tertiary-muted transition hover:text-red-500"
              title="Excluir"
              aria-label="Excluir iniciativa"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11.5px] tabular-nums text-secondary-muted">
          <span>
            {initiative.progress.completed_tickets} / {initiative.progress.total_tickets} tickets
          </span>
          <span className="font-medium text-primary">{initiative.progress.percentage}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--overlay-subtle)]">
          <div
            className={cn('h-full rounded-full transition-all', HEALTH_BAR[health])}
            style={{ width: `${Math.min(100, initiative.progress.percentage)}%` }}
          />
        </div>
      </div>

      {/* Projects pills */}
      {initiative.projects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {initiative.projects.map((p) => (
            <button
              key={p.project_id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/roadmap?project_id=${p.project_id}` as Route);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-0.5 text-[11px] font-medium text-secondary-muted transition hover:text-primary"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: p.color ?? '#64748b' }}
              />
              {p.name}
              <span className="font-mono text-[9.5px] text-tertiary-muted">{p.prefix}</span>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-tertiary-muted">
        <div className="flex items-center gap-3">
          {rel ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={11} />
              {rel}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-tertiary-muted">
              <CalendarClock size={11} />
              sem prazo
            </span>
          )}
        </div>
        {initiative.owner_name ? (
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full text-[9.5px] font-bold text-white"
              style={{ backgroundColor: colorFromName(initiative.owner_name) }}
            >
              {getInitials(initiative.owner_name)}
            </div>
            <span>{initiative.owner_name}</span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1">
            <UserIcon size={11} />
            sem owner
          </span>
        )}
      </div>
    </div>
  );
}
