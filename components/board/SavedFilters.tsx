'use client';

import { useState, useEffect, useRef } from 'react';
import { Filter, Save, Trash2, Share2, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { BoardFilterState } from './BoardFilters';

interface SavedFilter {
  id: string;
  name: string;
  filter_config: BoardFilterState;
  is_shared: boolean;
  creator_name: string;
  created_at: string;
}

interface SavedFiltersProps {
  currentFilters: BoardFilterState;
  onApplyFilter: (config: BoardFilterState) => void;
}

export default function SavedFilters({ currentFilters, onApplyFilter }: SavedFiltersProps) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveShared, setSaveShared] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSaving(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchFilters() {
    try {
      const res = await fetch('/api/filters');
      if (res.ok) {
        const data = await res.json();
        setFilters(data);
      }
    } catch {
      // silently fail
    }
  }

  async function saveFilter() {
    if (!saveName.trim()) return;

    try {
      const res = await fetch('/api/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          filter_config: currentFilters,
          is_shared: saveShared,
        }),
      });

      if (res.ok) {
        setSaveName('');
        setSaveShared(false);
        setSaving(false);
        fetchFilters();
      }
    } catch {
      // silently fail
    }
  }

  async function deleteFilter(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/filters?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFilters((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {
      // silently fail
    }
  }

  function applyFilter(filter: SavedFilter) {
    onApplyFilter(filter.filter_config);
    setOpen(false);
  }

  function getFilterSummary(config: BoardFilterState): string {
    const parts: string[] = [];
    if (config.search) parts.push(`"${config.search}"`);
    if (config.services?.length) parts.push(`${config.services.length} servico(s)`);
    if (config.assignees?.length) parts.push(`${config.assignees.length} responsavel(is)`);
    if (config.types?.length) parts.push(`${config.types.length} tipo(s)`);
    if (config.priorities?.length) parts.push(`${config.priorities.length} prioridade(s)`);
    return parts.length > 0 ? parts.join(', ') : 'Sem filtros';
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-[5px] text-[11px] font-medium transition-all duration-100',
          'bg-white/[0.03] text-slate-500 ring-1 ring-white/[0.04] hover:bg-white/[0.06] hover:text-slate-300',
          open && 'bg-white/[0.06] text-slate-300 ring-blue-500/30'
        )}
      >
        <Filter size={12} />
        Filtros
        <ChevronDown size={10} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-white/[0.08] bg-[#1e2024] shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
            <span className="text-[12px] font-semibold text-slate-300">Filtros salvos</span>
            <button
              onClick={() => setSaving(!saving)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-blue-400 transition hover:bg-blue-500/10"
            >
              <Save size={11} />
              Salvar atual
            </button>
          </div>

          {/* Save form */}
          {saving && (
            <div className="border-b border-white/[0.06] p-3 space-y-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nome do filtro..."
                autoFocus
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-[6px] text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/40"
                onKeyDown={(e) => e.key === 'Enter' && saveFilter()}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveShared}
                    onChange={(e) => setSaveShared(e.target.checked)}
                    className="rounded border-white/20 bg-white/5"
                  />
                  <Share2 size={11} />
                  Compartilhado
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSaving(false)}
                    className="rounded px-2 py-1 text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveFilter}
                    disabled={!saveName.trim()}
                    className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-blue-500 disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filter list */}
          <div className="max-h-64 overflow-y-auto">
            {filters.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-slate-600">
                Nenhum filtro salvo
              </div>
            ) : (
              filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => applyFilter(filter)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-white/[0.04] group"
                >
                  <Filter size={12} className="mt-0.5 text-slate-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-medium text-slate-300 truncate">{filter.name}</span>
                      {filter.is_shared && (
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-medium text-blue-400 shrink-0">
                          Compartilhado
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 truncate block">
                      {getFilterSummary(filter.filter_config)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => deleteFilter(filter.id, e)}
                    className="mt-0.5 rounded p-1 text-slate-700 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
