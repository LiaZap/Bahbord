'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
  { id: 'urgent', label: 'Urgente', color: 'bg-red-500' },
  { id: 'high', label: 'Alta', color: 'bg-orange-400' },
  { id: 'medium', label: 'Média', color: 'bg-yellow-400' },
  { id: 'low', label: 'Baixa', color: 'bg-blue-400' },
];

export default function BoardFilters({ filters, onFiltersChange, availableServices, availableAssignees, availableTypes }: BoardFiltersProps) {
  const hasActiveFilters = filters.search || filters.services.length > 0 || filters.assignees.length > 0 || filters.types.length > 0 || filters.priorities.length > 0;

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
    <div className="mb-4 space-y-2">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Buscar por título ou key..."
            className="w-full rounded-md border border-border/40 bg-surface pl-8 pr-3 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/60"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-400 transition hover:bg-surface2 hover:text-slate-200"
          >
            <X size={12} />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Filter badges */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Services */}
        {availableServices.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-600">Serviço:</span>
            {availableServices.map((s) => (
              <button
                key={s}
                onClick={() => toggleFilter('services', s)}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] font-medium transition',
                  filters.services.includes(s)
                    ? 'bg-accent/20 text-accent'
                    : 'bg-surface text-slate-500 hover:text-slate-300'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Types */}
        {availableTypes.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-600">Tipo:</span>
            {availableTypes.map((t) => (
              <button
                key={t.name}
                onClick={() => toggleFilter('types', t.name)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] transition',
                  filters.types.includes(t.name)
                    ? 'bg-accent/20 text-accent'
                    : 'bg-surface text-slate-500 hover:text-slate-300'
                )}
              >
                {t.icon}
              </button>
            ))}
          </div>
        )}

        {/* Priority */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-600">Prioridade:</span>
          {priorities.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleFilter('priorities', p.id)}
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition',
                filters.priorities.includes(p.id)
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface text-slate-500 hover:text-slate-300'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', p.color)} />
              {p.label}
            </button>
          ))}
        </div>

        {/* Assignees */}
        {availableAssignees.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-600">Responsável:</span>
            {availableAssignees.map((a) => (
              <button
                key={a}
                onClick={() => toggleFilter('assignees', a)}
                className={cn(
                  'rounded px-2 py-0.5 text-[10px] transition',
                  filters.assignees.includes(a)
                    ? 'bg-accent/20 text-accent'
                    : 'bg-surface text-slate-500 hover:text-slate-300'
                )}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
