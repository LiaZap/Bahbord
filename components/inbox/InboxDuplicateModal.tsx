'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, TriangleAlert } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { InboxItem, TicketSearchResult } from './types';

interface InboxDuplicateModalProps {
  item: InboxItem | null;
  isOpen: boolean;
  onClose: () => void;
  onMarked: (itemId: string) => void;
}

export default function InboxDuplicateModal({
  item,
  isOpen,
  onClose,
  onMarked,
}: InboxDuplicateModalProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TicketSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }
    // Pré-popula com o título do item para acelerar a busca
    if (item?.title) setQuery(item.title.slice(0, 80));
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen, item]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/tickets/search?q=${encodeURIComponent(trimmed)}&limit=15`,
        );
        if (!res.ok) {
          if (!cancelled) setResults([]);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setResults(Array.isArray(data) ? data : data?.data || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!item) return null;

  async function markDuplicate(ticket: TicketSearchResult) {
    if (!item) return;
    setSubmitting(ticket.id);
    try {
      const res = await fetch(`/api/inbox/${item.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicate_of_ticket_id: ticket.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || 'Erro ao marcar duplicata', 'error');
        return;
      }
      toast(`Marcado como duplicata de ${ticket.ticket_key}`, 'success');
      onMarked(item.id);
      onClose();
    } catch {
      toast('Erro de conexão', 'error');
    } finally {
      setSubmitting(null);
    }
  }

  const aiSuggested = item.ai_suggestion?.duplicate_ticket_id;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Marcar como duplicata"
      maxWidth="max-w-[560px]"
    >
      <div className="space-y-3 px-5 py-4">
        {aiSuggested && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-300">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            <p>
              IA sugere{' '}
              <span className="font-mono font-semibold">{aiSuggested}</span>{' '}
              como possível duplicata. Confirme abaixo escolhendo o ticket
              correto.
            </p>
          </div>
        )}

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary-muted"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ticket por título ou chave (ex: BAH-123)"
            className="input-premium w-full pl-9"
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto rounded-md border border-[var(--card-border)]">
          {loading && (
            <div className="px-3 py-6 text-center text-[12px] text-secondary-muted">
              Buscando...
            </div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-6 text-center text-[12px] text-secondary-muted">
              Nenhum ticket encontrado.
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <div className="px-3 py-6 text-center text-[12px] text-tertiary-muted">
              Digite ao menos 2 caracteres para buscar.
            </div>
          )}
          {results.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => markDuplicate(t)}
              disabled={submitting !== null}
              className="flex w-full items-center gap-3 border-b border-[var(--card-border)] px-3 py-2.5 text-left transition last:border-0 hover:bg-[var(--overlay-hover)] disabled:opacity-50"
            >
              <span className="font-mono text-[11.5px] font-semibold text-primary">
                {t.ticket_key}
              </span>
              <span className="flex-1 truncate text-[13px] text-secondary-muted">
                {t.title}
              </span>
              {t.status_name && (
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: (t.status_color || '#3b6cf5') + '20',
                    color: t.status_color || '#3b6cf5',
                  }}
                >
                  {t.status_name}
                </span>
              )}
              {submitting === t.id && (
                <span className="text-[11px] text-secondary-muted">
                  marcando...
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end border-t border-[var(--card-border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-ghost"
            disabled={submitting !== null}
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
