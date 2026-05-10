'use client';

import {
  Pencil,
  Target,
  Rocket,
  TrendingUp,
  Star,
  Flag,
  Trophy,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { HealthStatus } from '../RoadmapView';
import { HEALTH_BADGE, HEALTH_LABELS, formatDateTime } from './shared';

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

export function renderIcon(iconKey: string | null, size = 18): JSX.Element {
  if (!iconKey) return <Target size={size} />;
  const Comp = ICON_MAP[iconKey.toLowerCase()];
  if (Comp) return <Comp size={size} />;
  return <span className="text-[18px] leading-none">{iconKey}</span>;
}

interface BannerProps {
  name: string;
  goal: string | null;
  color: string | null;
  icon: string | null;
  health: HealthStatus;
  updatedAt: string;
  canMutate: boolean;
  onEdit: () => void;
}

/** Cabeçalho colorido da iniciativa — gradiente, ícone, badge e botão Editar. */
export default function Banner({
  name,
  goal,
  color,
  icon,
  health,
  updatedAt,
  canMutate,
  onEdit,
}: BannerProps): JSX.Element {
  return (
    <div
      className="rounded-xl border border-[var(--card-border)] p-6"
      style={{
        background: `linear-gradient(135deg, ${color ?? '#3b6cf5'}22 0%, var(--card-bg) 100%)`,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: color ?? '#3b6cf5' }}
          >
            {renderIcon(icon, 24)}
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold text-primary leading-tight">{name}</h1>
            {goal && <p className="mt-1.5 text-[13px] text-secondary-muted">{goal}</p>}
            <div className="mt-3 inline-flex items-center gap-2">
              <span className={cn('badge border', HEALTH_BADGE[health])}>
                {HEALTH_LABELS[health]}
              </span>
              <span className="text-[11.5px] text-tertiary-muted">
                Atualizada {formatDateTime(updatedAt)}
              </span>
            </div>
          </div>
        </div>
        {canMutate && (
          <button type="button" onClick={onEdit} className="btn-premium btn-secondary">
            <Pencil size={13} />
            Editar
          </button>
        )}
      </div>
    </div>
  );
}
