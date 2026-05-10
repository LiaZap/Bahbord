'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Link2,
  Mail,
  MessageSquare,
  Search,
  Trash2,
  Unlink,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';

type Source = 'manual' | 'share_link' | 'email' | 'form';

interface CustomerRequest {
  id: string;
  workspace_id: string;
  ticket_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  request_text: string;
  source: Source;
  source_url: string | null;
  resolved_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
}

interface TicketSearchResult {
  id: string;
  title: string;
  ticket_key?: string;
}

const sourceLabels: Record<Source, string> = {
  manual: 'Manual',
  share_link: 'Share link',
  email: 'E-mail',
  form: 'Formulário',
};

const sourceColors: Record<Source, string> = {
  manual: 'bg-[var(--overlay-subtle)] text-secondary-muted',
  share_link: 'bg-blue-500/10 text-blue-400',
  email: 'bg-amber-500/10 text-amber-400',
  form: 'bg-purple-500/10 text-purple-400 dark:text-purple-300',
};

type ResolvedFilter = 'all' | 'open' | 'resolved';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function CustomerRequestsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [items, setItems] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<Source | 'all'>('all');
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('all');

  // Link modal state
  const [linkTarget, setLinkTarget] = useState<CustomerRequest | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<TicketSearchResult[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/customer-requests');
      if (!res.ok) {
        setError('Erro ao carregar pedidos');
        return;
      }
      const data = (await res.json()) as CustomerRequest[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (sourceFilter !== 'all' && it.source !== sourceFilter) return false;
      if (resolvedFilter === 'open' && it.resolved_at) return false;
      if (resolvedFilter === 'resolved' && !it.resolved_at) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          it.customer_email,
          it.customer_name,
          it.request_text,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, sourceFilter, resolvedFilter]);

  // ── Actions ────────────────────────────────────────
  async function handleResolve(req: CustomerRequest) {
    try {
      const res = await fetch(`/api/customer-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_at: 'now' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err?.error || 'Erro ao resolver', 'error');
        return;
      }
      toast('Pedido resolvido', 'success');
      await fetchAll();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  async function handleUnlink(req: CustomerRequest) {
    const ok = await confirm({
      title: 'Desvincular pedido',
      message: 'O pedido continuará registrado mas deixará de estar ligado ao ticket.',
      confirmText: 'Desvincular',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/customer-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err?.error || 'Erro ao desvincular', 'error');
        return;
      }
      toast('Desvinculado', 'success');
      await fetchAll();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  async function handleDelete(req: CustomerRequest) {
    const ok = await confirm({
      title: 'Excluir pedido',
      message: `Excluir definitivamente o pedido de ${req.customer_email || 'cliente anônimo'}?`,
      confirmText: 'Excluir',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/customer-requests/${req.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err?.error || 'Erro ao excluir', 'error');
        return;
      }
      toast('Pedido excluído', 'success');
      await fetchAll();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  // ── Link to ticket modal ──────────────────────────
  function openLinkModal(req: CustomerRequest) {
    setLinkTarget(req);
    setLinkSearch('');
    setLinkResults([]);
  }

  function closeLinkModal() {
    setLinkTarget(null);
    setLinkSearch('');
    setLinkResults([]);
  }

  async function searchTickets(q: string) {
    setLinkSearch(q);
    if (q.trim().length < 2) {
      setLinkResults([]);
      return;
    }
    setLinkSearching(true);
    try {
      const res = await fetch(`/api/tickets/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as TicketSearchResult[];
        setLinkResults(data.slice(0, 8));
      }
    } catch {
      setLinkResults([]);
    } finally {
      setLinkSearching(false);
    }
  }

  async function linkToTicket(ticketId: string) {
    if (!linkTarget) return;
    try {
      const res = await fetch(`/api/customer-requests/${linkTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err?.error || 'Erro ao vincular', 'error');
        return;
      }
      toast('Pedido vinculado ao ticket', 'success');
      closeLinkModal();
      await fetchAll();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  const counts = useMemo(() => {
    const open = items.filter((i) => !i.resolved_at).length;
    return { total: items.length, open, resolved: items.length - open };
  }, [items]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md p-1.5 text-tertiary-muted hover:bg-[var(--overlay-hover)] hover:text-primary"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <MessageSquare size={18} className="text-purple-400 dark:text-purple-300" />
            Pedidos de clientes
          </h1>
          <p className="mt-1 text-sm text-secondary-muted">
            Voz do cliente — capture demandas vindas de e-mail, formulário, share-link ou registro manual.
          </p>
        </div>
        <div className="hidden gap-3 md:flex">
          <Stat label="Total" value={counts.total} />
          <Stat label="Abertos" value={counts.open} accent="text-amber-400" />
          <Stat label="Resolvidos" value={counts.resolved} accent="text-emerald-400" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por e-mail, nome ou texto..."
            className="w-full rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] py-2 pl-9 pr-3 text-sm text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as Source | 'all')}
          className="rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-2 text-sm text-primary outline-none"
        >
          <option value="all">Todas as fontes</option>
          <option value="manual">Manual</option>
          <option value="share_link">Share link</option>
          <option value="email">E-mail</option>
          <option value="form">Formulário</option>
        </select>
        <div className="flex rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-0.5">
          {(['all', 'open', 'resolved'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setResolvedFilter(k)}
              className={cn(
                'rounded px-3 py-1.5 text-[12px] font-medium transition',
                resolvedFilter === k
                  ? 'bg-[var(--card-bg)] text-primary'
                  : 'text-tertiary-muted hover:text-primary'
              )}
            >
              {k === 'all' ? 'Todos' : k === 'open' ? 'Abertos' : 'Resolvidos'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--card-border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--card-border)] bg-[var(--overlay-subtle)]">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">Cliente</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">Pedido</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">Fonte</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">Ticket</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">Data</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-secondary-muted text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-tertiary-muted">
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <MessageSquare size={28} className="mx-auto mb-2 text-tertiary-muted opacity-50" />
                  <p className="text-sm text-tertiary-muted">
                    {items.length === 0
                      ? 'Nenhum pedido recebido ainda.'
                      : 'Nenhum pedido corresponde aos filtros atuais.'}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((req) => {
                const resolved = !!req.resolved_at;
                return (
                  <tr
                    key={req.id}
                    className="border-b border-[var(--card-border)] transition hover:bg-[var(--overlay-subtle)]"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-1.5">
                        <Mail size={12} className="mt-0.5 shrink-0 text-tertiary-muted" />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-primary">
                            {req.customer_name || req.customer_email || 'Anônimo'}
                          </div>
                          {req.customer_name && req.customer_email && (
                            <div className="truncate text-[11px] text-tertiary-muted">
                              {req.customer_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[320px] px-4 py-3 align-top">
                      <p
                        className="text-[12.5px] leading-snug text-secondary-muted line-clamp-2"
                        title={req.request_text}
                      >
                        {req.request_text}
                      </p>
                      {req.source_url && (
                        <a
                          href={req.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
                        >
                          <ExternalLink size={9} />
                          origem
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={cn(
                          'inline-flex rounded px-2 py-[2px] text-[10px] font-medium',
                          sourceColors[req.source]
                        )}
                      >
                        {sourceLabels[req.source]}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {req.ticket_id ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/ticket/${req.ticket_id}` as never)}
                          className="text-[12px] text-blue-400 hover:underline"
                        >
                          Abrir ticket
                        </button>
                      ) : (
                        <span className="text-[12px] text-tertiary-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[12px] text-secondary-muted whitespace-nowrap">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {resolved ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-[2px] text-[10px] font-medium text-emerald-400">
                          <Check size={10} strokeWidth={2.5} />
                          Resolvido
                        </span>
                      ) : (
                        <span className="inline-flex rounded bg-amber-500/10 px-2 py-[2px] text-[10px] font-medium text-amber-400">
                          Aberto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openLinkModal(req)}
                          className="rounded p-1.5 text-tertiary-muted hover:bg-[var(--overlay-hover)] hover:text-blue-400"
                          title={req.ticket_id ? 'Vincular a outro ticket' : 'Vincular a ticket'}
                        >
                          <Link2 size={13} />
                        </button>
                        {req.ticket_id && (
                          <button
                            type="button"
                            onClick={() => handleUnlink(req)}
                            className="rounded p-1.5 text-tertiary-muted hover:bg-[var(--overlay-hover)] hover:text-amber-400"
                            title="Desvincular"
                          >
                            <Unlink size={13} />
                          </button>
                        )}
                        {!resolved && (
                          <button
                            type="button"
                            onClick={() => handleResolve(req)}
                            className="rounded p-1.5 text-tertiary-muted hover:bg-[var(--overlay-hover)] hover:text-emerald-400"
                            title="Marcar como resolvido"
                          >
                            <Check size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(req)}
                          className="rounded p-1.5 text-tertiary-muted hover:bg-[var(--overlay-hover)] hover:text-red-400"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Link to ticket modal */}
      <Modal
        isOpen={!!linkTarget}
        onClose={closeLinkModal}
        title="Vincular pedido a ticket"
        maxWidth="max-w-md"
      >
        <div className="space-y-3 px-5 py-4">
          {linkTarget && (
            <div className="rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-3">
              <p className="text-[11px] text-tertiary-muted">Pedido</p>
              <p className="mt-1 text-[13px] text-primary line-clamp-2">{linkTarget.request_text}</p>
            </div>
          )}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tertiary-muted" />
            <input
              autoFocus
              value={linkSearch}
              onChange={(e) => searchTickets(e.target.value)}
              placeholder="Buscar ticket por título ou key..."
              className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] py-2 pl-8 pr-3 text-[13px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
            />
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {linkSearching && (
              <p className="px-2 py-1 text-[12px] text-tertiary-muted">Buscando...</p>
            )}
            {!linkSearching && linkSearch.length >= 2 && linkResults.length === 0 && (
              <p className="px-2 py-1 text-[12px] text-tertiary-muted">Nenhum ticket encontrado.</p>
            )}
            {linkResults.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => linkToTicket(t.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[var(--overlay-hover)]"
              >
                {t.ticket_key && (
                  <span className="font-mono text-tertiary-muted shrink-0">{t.ticket_key}</span>
                )}
                <span className="truncate text-primary">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-tertiary-muted">{label}</div>
      <div className={cn('text-[15px] font-bold tabular-nums', accent || 'text-primary')}>
        {value}
      </div>
    </div>
  );
}
