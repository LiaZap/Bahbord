'use client';

import { Search, X, SlidersHorizontal, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import SavedFilters from './SavedFilters';

export interface BoardFilterState {
  search: string;
  services: string[];
  assignees: string[];
  types: string[];
  priorities: string[];
  projects: string[];
  /** Quando true, mostra apenas tickets com SLA overdue (filtragem client-side). */
  onlyOverdue?: boolean;
}

interface BoardFiltersProps {
  filters: BoardFilterState;
  onFiltersChange: (filters: BoardFilterState) => void;
  availableServices: string[];
  availableAssignees: string[];
  availableTypes: { icon: string; name: string }[];
  availableProjects?: { id: string; name: string }[];
  /** Total de tickets atualmente em estado overdue (pra mostrar contador no chip). */
  overdueCount?: number;
}

const priorities = [
  { id: 'urgent', label: 'Urgente', dot: 'bg-red-500' },
  { id: 'high', label: 'Alta', dot: 'bg-orange-400' },
  { id: 'medium', label: 'Média', dot: 'bg-blue-400' },
  { id: 'low', label: 'Baixa', dot: 'bg-slate-400' },
];

export default function BoardFilters({ filters, onFiltersChange, availableServices, availableAssignees, availableTypes, availableProjects = [], overdueCount = 0 }: BoardFiltersProps) {
  const tFilters = useTranslations('filters');
  const hasActiveFilters = filters.search || filters.services.length > 0 || filters.assignees.length > 0 || filters.types.length > 0 || filters.priorities.length > 0 || filters.projects.length > 0 || filters.onlyOverdue;
  const activeCount = filters.services.length + filters.assignees.length + filters.types.length + filters.priorities.length + filters.projects.length + (filters.onlyOverdue ? 1 : 0);

  function toggleFilter(key: keyof Pick<BoardFilterState, 'services' | 'assignees' | 'types' | 'priorities' | 'projects'>, value: string) {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  }

  function toggleOverdue() {
    onFiltersChange({ ...filters, onlyOverdue: !filters.onlyOverdue });
  }

  function clearFilters() {
    onFiltersChange({ search: '', services: [], assignees: [], types: [], priorities: [], projects: [], onlyOverdue: false });
  }

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      {/* Search — full-width em mobile, larguras fixas em ≥sm */}
      <div className="relative w-full sm:w-auto">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder={tFilters('search')}
          className="w-full sm:w-44 rounded-md border border-white/[0.06] bg-white/[0.03] pl-8 pr-3 py-[6px] text-[12px] text-slate-200 outline-none placeholder:text-slate-600 transition sm:focus:w-64 focus:border-blue-500/40 focus:bg-white/[0.05]"
        />
      </div>

      {/* Saved Filters */}
      <SavedFilters currentFilters={filters} onApplyFilter={onFiltersChange} />

      {/* Divider — esconde em mobile pra economizar espaço */}
      <div className="hidden sm:block h-5 w-px bg-white/[0.06]" />

      {/* Project pills */}
      {availableProjects.map((p) => (
        <button
          key={p.id}
          onClick={() => toggleFilter('projects', p.id)}
          className={cn(
            'rounded-md px-2.5 py-[5px] text-[11px] font-medium transition-all duration-100',
            filters.projects.includes(p.id)
              ? 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30'
              : 'bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.04] hover:bg-white/[0.06] hover:text-slate-300'
          )}
        >
          {p.name}
        </button>
      ))}

      {/* Priority pills */}
      {priorities.map((p) => (
        <button
          key={p.id}
          onClick={() => toggleFilter('priorities', p.id)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-[5px] text-[11px] font-medium transition-all duration-100',
            filters.priorities.includes(p.id)
              ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.04] hover:bg-white/[0.06] hover:text-slate-300'
          )}
        >
          <span className={cn('h-[6px] w-[6px] rounded-full', p.dot)} />
          {p.label}
        </button>
      ))}

      {/* SLA overdue chip — filtragem 100% client-side via useBoard */}
      <button
        onClick={toggleOverdue}
        title={tFilters('ticketsOverdueCount', { count: overdueCount })}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-[5px] text-[11px] font-medium transition-all duration-100',
          filters.onlyOverdue
            ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
            : 'bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.04] hover:bg-white/[0.06] hover:text-slate-300'
        )}
      >
        <Clock size={11} strokeWidth={2} />
        {tFilters('overdue')}
        {overdueCount > 0 && (
          <span className={cn(
            'rounded-full px-1.5 py-[0px] text-[10px] tabular-nums',
            filters.onlyOverdue ? 'bg-red-500/30 text-red-300' : 'bg-white/[0.06] text-secondary-muted'
          )}>
            {overdueCount}
          </span>
        )}
      </button>

      {/* Clear */}
      {hasActiveFilters && (
        <>
          <div className="h-5 w-px bg-white/[0.06]" />
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-md px-2 py-[5px] text-[11px] text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X size={12} />
            {tFilters('clear')} {activeCount > 0 && `(${activeCount})`}
          </button>
        </>
      )}
    </div>
  );
}
