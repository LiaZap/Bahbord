'use client';

import { Search, X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import SavedFilters from './SavedFilters';

export interface BoardFilterState {
  search: string;
  services: string[];
  assignees: string[];
  types: string[];
  priorities: string[];
}

interface BoardFiltersProps {
  filters: BoardFilterState;
  onFiltersChange: (filters: BoardFilterState) => void;
  availableServices: string[];
  availableAssignees: string[];
  availableTypes: { icon: string; name: string }[];
}

const priorities = [
  { id: 'urgent', label: 'Urgente', dot: 'bg-red-500' },
  { id: 'high', label: 'Alta', dot: 'bg-orange-400' },
  { id: 'medium', label: 'Média', dot: 'bg-blue-400' },
  { id: 'low', label: 'Baixa', dot: 'bg-slate-400' },
];

export default function BoardFilters({ filters, onFiltersChange, availableServices, availableAssignees, availableTypes }: BoardFiltersProps) {
  const hasActiveFilters = filters.search || filters.services.length > 0 || filters.assignees.length > 0 || filters.types.length > 0 || filters.priorities.length > 0;
  const activeCount = filters.services.length + filters.assignees.length + filters.types.length + filters.priorities.length;

  function toggleFilter(key: keyof Pick<BoardFilterState, 'services' | 'assignees' | 'types' | 'priorities'>, value: string) {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [key]: updated });
  }

  function clearFilters() {
    onFiltersChange({ search: '', services: [], assignees: [], types: [], priorities: [] });
  }

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Filtrar..."
          className="w-44 rounded-md border border-white/[0.06] bg-white/[0.03] pl-8 pr-3 py-[6px] text-[12px] text-slate-200 outline-none placeholder:text-slate-600 transition focus:w-64 focus:border-blue-500/40 focus:bg-white/[0.05]"
        />
      </div>

      {/* Saved Filters */}
      <SavedFilters currentFilters={filters} onApplyFilter={onFiltersChange} />

      {/* Divider */}
      <div className="h-5 w-px bg-white/[0.06]" />

      {/* Service pills */}
      {availableServices.map((s) => (
        <button
          key={s}
          onClick={() => toggleFilter('services', s)}
          className={cn(
            'rounded-md px-2.5 py-[5px] text-[11px] font-medium transition-all duration-100',
            filters.services.includes(s)
              ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.04] hover:bg-white/[0.06] hover:text-slate-300'
          )}
        >
          {s}
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

      {/* Type pills */}
      {availableTypes.map((t) => (
        <button
          key={t.name}
          onClick={() => toggleFilter('types', t.name)}
          className={cn(
            'rounded-md px-2 py-[5px] text-[12px] transition-all duration-100',
            filters.types.includes(t.name)
              ? 'bg-blue-500/15 ring-1 ring-blue-500/30'
              : 'bg-white/[0.03] ring-1 ring-white/[0.04] hover:bg-white/[0.06]'
          )}
        >
          {t.icon}
        </button>
      ))}

      {/* Clear */}
      {hasActiveFilters && (
        <>
          <div className="h-5 w-px bg-white/[0.06]" />
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-md px-2 py-[5px] text-[11px] text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X size={12} />
            Limpar {activeCount > 0 && `(${activeCount})`}
          </button>
        </>
      )}
    </div>
  );
}
