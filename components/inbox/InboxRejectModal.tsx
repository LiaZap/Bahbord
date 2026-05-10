'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { InboxItem } from './types';

interface InboxRejectModalProps {
  item: InboxItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRejected: (itemId: string) => void;
}

const REASON_MAX = 500;

export default function InboxRejectModal({
  item,
  isOpen,
  onClose,
  onRejected,
}: InboxRejectModalProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      return;
    }
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  if (!item) return null;

  async function handleReject() {
    if (!item) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inbox/${item.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error || 'Erro ao recusar', 'error');
        return;
      }
      toast('Item recusado', 'success');
      onRejected(item.id);
      onClose();
    } catch {
      toast('Erro de conexão', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recusar item da triagem"
      maxWidth="max-w-[480px]"
    >
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-[13px] text-secondary-muted">
            Recusar{' '}
            <span className="font-semibold text-primary">
              &ldquo;{item.title}&rdquo;
            </span>
            ? O item não vai virar ticket. A razão é opcional, mas ajuda no
            audit trail.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">
            Razão (opcional)
          </label>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            placeholder="Ex: spam, fora de escopo, já resolvido..."
            className="input-premium min-h-[100px] w-full resize-y leading-relaxed"
          />
          <p className="mt-1 text-right text-[10.5px] text-tertiary-muted">
            {reason.length}/{REASON_MAX}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--card-border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-premium btn-ghost"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="btn-premium btn-danger disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Recusando...' : 'Recusar definitivamente'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
