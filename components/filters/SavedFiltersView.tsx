'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Trash2, Pencil, Share2, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { BoardFilterState } from '@/components/board/BoardFilters';

interface SavedFilter {
  id: string;
  name: string;
  filter_config: BoardFilterState;
  is_shared: boolean;
  creator_name: string;
  created_at: string;
}

const priorityLabels: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baixa',
};

export default function SavedFiltersView() {
  const router = useRouter();
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editShared, setEditShared] = useState(false);

  useEffect(() => {
    fetchFilters();
  }, []);

  async function fetchFilters() {
    try {
      const res = await fetch('/api/filters');
      if (res.ok) {
        setFilters(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function deleteFilter(id: string) {
    try {
      const res = await fetch(`/api/filters?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFilters((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {
      // silently fail
    }
  }

  function startEdit(filter: SavedFilter) {
    setEditingId(filter.id);
    setEditName(filter.name);
    setEditShared(filter.is_shared);
  }

  async function saveEdit(id: string) {
    try {
      const res = await fetch('/api/filters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName, is_shared: editShared }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchFilters();
      }
    } catch {
      // silently fail
    }
  }

  function applyFilter(filter: SavedFilter) {
    const params = new URLSearchParams();
    const config = filter.filter_config;
    if (config.search) params.set('search', config.search);
    if (config.services?.length) params.set('services', config.services.join(','));
    if (config.assignees?.length) params.set('assignees', config.assignees.join(','));
    if (config.types?.length) params.set('types', config.types.join(','));
    if (config.priorities?.length) params.set('priorities', config.priorities.join(','));
    const qs = params.toString();
    router.push(`/board${qs ? `?${qs}` : ''}` as any);
  }

  function getFilterDetails(config: BoardFilterState): string {
    const parts: string[] = [];
    if (config.search) parts.push(`Busca: "${config.search}"`);
    if (config.services?.length) parts.push(`Servicos: ${config.services.join(', ')}`);
    if (config.assignees?.length) parts.push(`Responsaveis: ${config.assignees.join(', ')}`);
    if (config.types?.length) parts.push(`Tipos: ${config.types.join(', ')}`);
    if (config.priorities?.length) parts.push(`Prioridades: ${config.priorities.map((p) => priorityLabels[p] || p).join(', ')}`);
    return parts.length > 0 ? parts.join(' | ') : 'Sem filtros';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Filtros salvos</h1>
          <p className="text-[13px] text-slate-500">Gerencie seus filtros salvos e compartilhados</p>
        </div>
      </div>

      {filters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] py-16">
          <Filter size={32} className="mb-3 text-slate-600" />
          <p className="text-[13px] text-slate-500">Nenhum filtro salvo</p>
          <p className="mt-1 text-[12px] text-slate-600">Salve filtros a partir do quadro usando o botao "Filtros"</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nome</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Criador</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Compartilhado</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Detalhes do filtro</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Criado em</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filters.map((filter) => (
                <tr
                  key={filter.id}
                  onClick={() => applyFilter(filter)}
                  className="border-b border-white/[0.04] transition hover:bg-white/[0.03] cursor-pointer group"
                >
                  <td className="px-4 py-3">
                    {editingId === filter.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(filter.id)}
                        autoFocus
                        className="w-full rounded border border-blue-500/40 bg-white/[0.05] px-2 py-1 text-[13px] text-slate-200 outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Filter size={14} className="text-slate-600" />
                        <span className="text-[13px] font-medium text-slate-200">{filter.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-400">{filter.creator_name || '-'}</td>
                  <td className="px-4 py-3">
                    {editingId === filter.id ? (
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={editShared}
                          onChange={(e) => setEditShared(e.target.checked)}
                          className="rounded border-white/20 bg-white/5"
                        />
                        Sim
                      </label>
                    ) : filter.is_shared ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        <Share2 size={10} />
                        Sim
                      </span>
                    ) : (
                      <span className="text-[12px] text-slate-600">Privado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500 max-w-xs truncate">
                    {getFilterDetails(filter.filter_config)}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{formatDate(filter.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                      {editingId === filter.id ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); saveEdit(filter.id); }}
                            className="rounded p-1.5 text-green-400 hover:bg-green-500/10"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                            className="rounded p-1.5 text-slate-400 hover:bg-white/[0.06]"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(filter); }}
                            className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFilter(filter.id); }}
                            className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
