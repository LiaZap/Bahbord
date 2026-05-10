'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, MinusCircle, Link2, Plus, Search, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';

type RelationType = 'blocks' | 'blocked_by' | 'relates_to';

interface Relation {
  id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  relation_type: RelationType;
  target_ticket_key: string | null;
  target_title: string | null;
  target_status_name: string | null;
  target_status_color: string | null;
  target_is_done: boolean | null;
}

interface SearchResult {
  id: string;
  title: string;
  ticket_key?: string;
}

interface TicketDependenciesProps {
  ticketId: string;
}

const typeMeta: Record<RelationType, { label: string; sectionLabel: string; icon: typeof Ban; iconColor: string }> = {
  blocks: { label: 'Bloqueia', sectionLabel: 'Bloqueia', icon: Ban, iconColor: 'text-red-400' },
  blocked_by: { label: 'Bloqueado por', sectionLabel: 'Bloqueado por', icon: MinusCircle, iconColor: 'text-amber-400' },
  relates_to: { label: 'Relacionado', sectionLabel: 'Relacionado', icon: Link2, iconColor: 'text-blue-400' },
};

const ORDER: RelationType[] = ['blocks', 'blocked_by', 'relates_to'];

export default function TicketDependencies({ ticketId }: TicketDependenciesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<RelationType>('blocked_by');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchRelations = useCallback(async () => {
    try {
      const res = await fetch(`/api/ticket-relations?ticket_id=${ticketId}`);
      if (res.ok) {
        const data: Relation[] = await res.json();
        setRelations(data);
      }
    } catch {
      // silencioso — mostra vazio
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void fetchRelations();
  }, [fetchRelations]);

  // Fechar painel de busca quando clica fora
  useEffect(() => {
    if (!showAdd) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowAdd(false);
        setSearch('');
        setResults([]);
        setSearchError(null);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showAdd]);

  async function handleSearch(q: string) {
    setSearch(q);
    setSearchError(null);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/tickets/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setResults(data.filter((t) => t.id !== ticketId).slice(0, 8));
      }
    } catch {
      setResults([]);
    }
  }

  async function addRelation(targetId: string) {
    if (targetId === ticketId) {
      setSearchError('Um ticket não pode se relacionar com ele mesmo');
      return;
    }
    // Evitar duplicatas locais
    if (relations.some((r) => r.target_ticket_id === targetId && r.relation_type === type)) {
      toast('Esta relação já existe', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/ticket-relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_ticket_id: ticketId,
          target_ticket_id: targetId,
          relation_type: type,
        }),
      });
      if (res.ok) {
        toast('Bloqueio adicionado', 'success');
        setShowAdd(false);
        setSearch('');
        setResults([]);
        await fetchRelations();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Erro ao adicionar', 'error');
      }
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  async function removeRelation(rel: Relation) {
    const meta = typeMeta[rel.relation_type];
    const ok = await confirm({
      title: 'Remover relação',
      message: `Remover "${meta.label}: ${rel.target_ticket_key || rel.target_title}"?`,
      confirmText: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/ticket-relations?id=${rel.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Relação removida', 'success');
        await fetchRelations();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Erro ao remover', 'error');
      }
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  const grouped: Record<RelationType, Relation[]> = {
    blocks: [],
    blocked_by: [],
    relates_to: [],
  };
  for (const r of relations) {
    grouped[r.relation_type].push(r);
  }

  const hasAny = relations.length > 0;

  return (
    <div ref={containerRef} className="rounded-lg border border-[var(--card-border)] bg-[var(--modal-bg)]">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-semibold text-primary">Bloqueios</span>
        {hasAny && <span className="text-[11px] tabular-nums text-tertiary-muted">{relations.length}</span>}
      </div>
      <div className="border-t border-[var(--card-border)] px-4 py-3 space-y-2">
        {loading ? (
          <p className="text-[12px] text-tertiary-muted">Carregando...</p>
        ) : !hasAny ? (
          <p className="text-[12px] text-tertiary-muted italic">Nenhum bloqueio.</p>
        ) : (
          ORDER.filter((t) => grouped[t].length > 0).map((t) => {
            const meta = typeMeta[t];
            const Icon = meta.icon;
            return (
              <div key={t} className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tertiary-muted">
                  {meta.sectionLabel}
                </p>
                {grouped[t].map((rel) => (
                  <div
                    key={rel.id}
                    className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--overlay-subtle)]"
                  >
                    <Icon size={12} className={meta.iconColor} />
                    <button
                      type="button"
                      onClick={() => router.push(`/ticket/${rel.target_ticket_id}` as any)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      title={rel.target_title || ''}
                    >
                      <span className="font-mono text-[11px] font-bold text-secondary-muted shrink-0">
                        {rel.target_ticket_key || '—'}
                      </span>
                      <span className="truncate text-[12px] text-primary hover:text-blue-400">
                        {rel.target_title || 'Sem título'}
                      </span>
                      {rel.target_status_name && (
                        <span
                          className="hidden md:inline-flex shrink-0 rounded px-1 py-[1px] text-[9px] font-medium"
                          style={{
                            backgroundColor: (rel.target_status_color || '#64748b') + '20',
                            color: rel.target_status_color || '#94a3b8',
                          }}
                        >
                          {rel.target_status_name}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRelation(rel)}
                      title="Remover relação"
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-tertiary-muted hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })
        )}

        {showAdd ? (
          <div className="mt-2 space-y-2 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-2">
            <div className="flex gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RelationType)}
                className="rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[12px] text-primary outline-none"
              >
                {ORDER.map((t) => (
                  <option key={t} value={t}>{typeMeta[t].label}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-tertiary-muted" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar ticket..."
                  className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] py-1 pl-7 pr-2 text-[12px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setSearch('');
                  setResults([]);
                  setSearchError(null);
                }}
                className="text-tertiary-muted hover:text-primary"
                aria-label="Cancelar"
              >
                <X size={14} />
              </button>
            </div>
            {searchError && (
              <p className="text-[11px] text-red-400">{searchError}</p>
            )}
            {results.length > 0 && (
              <div className="max-h-44 space-y-0.5 overflow-auto">
                {results.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addRelation(t.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] hover:bg-[var(--overlay-hover)]"
                  >
                    <span className="font-mono text-tertiary-muted shrink-0">{t.ticket_key}</span>
                    <span className="truncate text-primary">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
            {search.length >= 2 && results.length === 0 && (
              <p className="text-[11px] text-tertiary-muted">Nenhum ticket encontrado.</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-1 flex items-center gap-1 text-[12px] text-secondary-muted hover:text-blue-400"
          >
            <Plus size={12} /> Adicionar bloqueio
          </button>
        )}
      </div>
    </div>
  );
}
