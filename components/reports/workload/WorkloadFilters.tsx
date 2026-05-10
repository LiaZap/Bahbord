'use client';

import { cn } from '@/lib/utils/cn';
import { RefreshCw, BarChart3 } from 'lucide-react';
import type { MeData, WorkloadProject } from './types';

interface FiltersProps {
  draftFrom: string;
  draftTo: string;
  projectId: string;
  onlyMe: boolean;
  me: MeData | null;
  loading: boolean;
  projects: WorkloadProject[];
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  onChangeProject: (v: string) => void;
  onChangeOnlyMe: (v: boolean) => void;
  onApply: () => void;
  onReload: () => void;
}

export function WorkloadHeader({ loading, onReload }: { loading: boolean; onReload: () => void }): JSX.Element {
  return (
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
        onClick={onReload}
        disabled={loading}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-xs font-medium text-primary transition',
          'hover:bg-[var(--overlay-hover)] disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        aria-label="Atualizar"
      >
        <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        Atualizar
      </button>
    </div>
  );
}

export default function WorkloadFilters({
  draftFrom,
  draftTo,
  projectId,
  onlyMe,
  me,
  projects,
  onChangeFrom,
  onChangeTo,
  onChangeProject,
  onChangeOnlyMe,
  onApply,
}: FiltersProps): JSX.Element {
  return (
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
            onChange={(e) => onChangeFrom(e.target.value)}
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
            onChange={(e) => onChangeTo(e.target.value)}
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
            onChange={(e) => onChangeProject(e.target.value)}
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
              onChange={(e) => onChangeOnlyMe(e.target.checked)}
              disabled={!me}
              className="h-3.5 w-3.5 rounded border-[var(--card-border)] accent-[var(--accent)]"
            />
            <span className="text-xs">Apenas eu</span>
          </label>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={onApply}
            className="w-full rounded bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
