'use client';

import { cn } from '@/lib/utils/cn';
import type { HealthStatus } from './RoadmapView';

export type HealthFilter = 'all' | HealthStatus;

interface FilterChip {
  key: HealthFilter;
  label: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'Todas' },
  { key: 'on_track', label: 'No prazo' },
  { key: 'at_risk', label: 'Em risco' },
  { key: 'off_track', label: 'Atrasado' },
  { key: 'completed', label: 'Concluído' },
];

interface RoadmapFiltersProps {
  healthFilter: HealthFilter;
  showArchived: boolean;
  projectFilterName: string | null;
  onChangeHealthFilter: (v: HealthFilter) => void;
  onChangeShowArchived: (v: boolean) => void;
  onClearProjectFilter: () => void;
}

/**
 * Filtros do RoadmapView: chips de health, toggle "mostrar arquivadas" e
 * indicador do filtro de projeto vindo da query string.
 */
export default function RoadmapFilters({
  healthFilter,
  showArchived,
  projectFilterName,
  onChangeHealthFilter,
  onChangeShowArchived,
  onClearProjectFilter,
}: RoadmapFiltersProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChangeHealthFilter(chip.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] font-medium transition',
              healthFilter === chip.key
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--card-border)] text-secondary-muted hover:bg-[var(--overlay-subtle)] hover:text-primary',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12px] text-secondary-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => onChangeShowArchived(e.target.checked)}
          className="rounded border-[var(--card-border)]"
        />
        Mostrar arquivadas
      </label>
      {projectFilterName && (
        <div className="ml-auto flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2.5 py-1 text-[12px] text-secondary-muted">
          <span>
            Projeto: <span className="text-primary font-medium">{projectFilterName}</span>
          </span>
          <button
            type="button"
            onClick={onClearProjectFilter}
            className="text-tertiary-muted hover:text-primary"
            aria-label="Limpar filtro"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
