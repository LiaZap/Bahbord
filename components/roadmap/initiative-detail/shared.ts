/**
 * Constantes/helpers compartilhados pelos sub-componentes do InitiativeDetail.
 * Mantemos os mesmos badges/cores do RoadmapView pra consistência visual.
 */

import type { HealthStatus } from '../RoadmapView';

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  on_track: 'No prazo',
  at_risk: 'Em risco',
  off_track: 'Atrasado',
  completed: 'Concluído',
  archived: 'Arquivado',
};

export const HEALTH_BADGE: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  at_risk: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  off_track: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  archived: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
};

export const HEALTH_BAR: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-red-500',
  completed: 'bg-blue-500',
  archived: 'bg-zinc-500',
};

export function isHealth(value: string): value is HealthStatus {
  return (
    value === 'on_track' ||
    value === 'at_risk' ||
    value === 'off_track' ||
    value === 'completed' ||
    value === 'archived'
  );
}

export function asHealth(value: string): HealthStatus {
  return isHealth(value) ? value : 'on_track';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
