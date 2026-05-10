'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Mail, MessageSquare, Plus, Send, Unlink, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';

interface CustomerRequest {
  id: string;
  workspace_id: string;
  ticket_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  request_text: string;
  source: 'manual' | 'share_link' | 'email' | 'form';
  source_url: string | null;
  resolved_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
}

interface Props {
  ticketId: string;
  isAdmin: boolean;
}

const sourceLabels: Record<CustomerRequest['source'], string> = {
  manual: 'Manual',
  share_link: 'Share link',
  email: 'E-mail',
  form: 'Formulário',
};

const sourceColors: Record<CustomerRequest['source'], string> = {
  manual: 'bg-[var(--overlay-subtle)] text-secondary-muted',
  share_link: 'bg-blue-500/10 text-blue-400',
  email: 'bg-amber-500/10 text-amber-400',
  form: 'bg-purple-500/10 text-purple-400 dark:text-purple-300',
};

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function CustomerRequestsSection({ ticketId, isAdmin }: Props) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ customer_email: '', customer_name: '', request_text: '' });

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer-requests?ticket_id=${ticketId}`);
      if (res.ok) {
        const data = (await res.json()) as CustomerRequest[];
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  function resetForm() {
    setForm({ customer_email: '', customer_name: '', request_text: '' });
    setShowAdd(false);
  }

  async function handleCreate() {
    if (!form.request_text.trim()) {
      toast('Descrição obrigatória', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          customer_email: form.customer_email.trim() || undefined,
          customer_name: form.customer_name.trim() || undefined,
          request_text: form.request_text.trim(),
          source: 'manual',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err?.error || 'Erro ao adicionar pedido', 'error');
        return;
      }
      toast('Pedido adicionado', 'success');
      resetForm();
      await fetchRequests();
    } catch {
      toast('Erro de conexão', 'error');
    } finally {
      setSubmitting(false);
    }
  }

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
      toast('Pedido marcado como resolvido', 'success');
      await fetchRequests();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  async function handleUnlink(req: CustomerRequest) {
    const ok = await confirm({
      title: 'Desvincular pedido',
      message: 'O pedido continuará registrado, mas deixará de estar ligado a este ticket.',
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
      toast('Pedido desvinculado', 'success');
      await fetchRequests();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  const total = requests.length;

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--modal-bg)]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={13} className="text-purple-400 dark:text-purple-300" />
          <span className="text-[13px] font-semibold text-primary">Pedidos de clientes</span>
          {total > 0 && (
            <span className="text-[11px] tabular-nums text-tertiary-muted">{total}</span>
          )}
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--card-border)] px-4 py-3">
        {loading ? (
          <p className="text-[12px] text-tertiary-muted">Carregando...</p>
        ) : total === 0 ? (
          <p className="text-[12px] italic text-tertiary-muted">
            Nenhum pedido registrado ainda.
          </p>
        ) : (
          requests.map((req) => {
            const resolved = !!req.resolved_at;
            return (
              <div
                key={req.id}
                className="group rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Mail size={11} className="shrink-0 text-tertiary-muted" />
                    <span className="truncate text-[12px] font-medium text-primary" title={req.customer_email || ''}>
                      {req.customer_name || req.customer_email || 'Anônimo'}
                    </span>
                    {req.customer_name && req.customer_email && (
                      <span className="truncate text-[11px] text-tertiary-muted">
                        {req.customer_email}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-tertiary-muted">
                    {relativeDate(req.created_at)}
                  </span>
                </div>

                <p
                  className="mb-2 text-[12px] leading-snug text-secondary-muted line-clamp-3"
                  title={req.request_text}
                >
                  {req.request_text}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-[1px] text-[10px] font-medium ${sourceColors[req.source]}`}
                    >
                      {sourceLabels[req.source]}
                    </span>
                    {resolved && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-[1px] text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                        <Check size={9} strokeWidth={2.5} />
                        Resolvido
                      </span>
                    )}
                  </div>

                  {isAdmin && !resolved && (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleResolve(req)}
                        className="rounded p-1 text-tertiary-muted hover:bg-[var(--overlay-hover)] hover:text-emerald-400"
                        title="Marcar como resolvido"
                        aria-label="Marcar como resolvido"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnlink(req)}
                        className="rounded p-1 text-tertiary-muted hover:bg-[var(--overlay-hover)] hover:text-amber-400"
                        title="Desvincular do ticket"
                        aria-label="Desvincular do ticket"
                      >
                        <Unlink size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isAdmin &&
          (showAdd ? (
            <div className="space-y-2 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-tertiary-muted">
                  Novo pedido
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-tertiary-muted hover:text-primary"
                  aria-label="Cancelar"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                value={form.customer_email}
                onChange={(e) => setForm((s) => ({ ...s, customer_email: e.target.value }))}
                placeholder="email@cliente.com"
                type="email"
                className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[12px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
              />
              <input
                value={form.customer_name}
                onChange={(e) => setForm((s) => ({ ...s, customer_name: e.target.value }))}
                placeholder="Nome (opcional)"
                className="w-full rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[12px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
              />
              <textarea
                value={form.request_text}
                onChange={(e) => setForm((s) => ({ ...s, request_text: e.target.value }))}
                placeholder="O que o cliente pediu..."
                rows={3}
                className="w-full resize-none rounded border border-[var(--card-border)] bg-[var(--modal-bg)] px-2 py-1 text-[12px] text-primary outline-none placeholder:text-tertiary-muted focus:border-blue-500/40"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[12px] text-tertiary-muted hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={submitting || !form.request_text.trim()}
                  className="inline-flex items-center gap-1 rounded bg-[var(--accent)] px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Send size={11} />
                  {submitting ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-1 flex items-center gap-1 text-[12px] text-secondary-muted hover:text-blue-400"
            >
              <Plus size={12} /> Adicionar pedido
            </button>
          ))}
      </div>
    </div>
  );
}
