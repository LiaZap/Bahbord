'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';

interface SnoozeMenuProps {
  ticketId: string;
  /** ISO string ou null se não está snoozed atualmente. */
  currentSnoozedUntil?: string | null;
  /** Callback após sucesso (ex: refetch). Recebe novo valor ou null. */
  onChanged?: (newSnoozedUntil: string | null) => void;
  /** Estilo compacto pra usar no card do board. */
  compact?: boolean;
  className?: string;
}

/** Calcula próxima segunda 9h (horário local). */
function nextMondayAt9(): Date {
  const d = new Date();
  const day = d.getDay(); // 0 = dom, 1 = seg ...
  // Quanto adicionar pra chegar na próxima segunda
  // Se hoje for segunda mas já passou das 9, segunda da semana que vem
  let add = (8 - day) % 7; // domingo->1, segunda->0, terça->6 etc
  if (day === 1) {
    const cutoff = new Date(d);
    cutoff.setHours(9, 0, 0, 0);
    if (d.getTime() >= cutoff.getTime()) add = 7;
  }
  if (add === 0 && day !== 1) add = 7;
  const target = new Date(d);
  target.setDate(d.getDate() + add);
  target.setHours(9, 0, 0, 0);
  return target;
}

function inDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function formatBadge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function SnoozeMenu({
  ticketId,
  currentSnoozedUntil,
  onChanged,
  compact = false,
  className,
}: SnoozeMenuProps) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isSnoozed =
    !!currentSnoozedUntil && new Date(currentSnoozedUntil).getTime() > Date.now();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowCustom(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function applySnooze(target: Date | null) {
    if (busy) return;
    setBusy(true);
    try {
      const body = JSON.stringify({ snoozed_until: target ? target.toISOString() : null });
      const res = await fetch(`/api/tickets/${ticketId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        toast(target ? 'Snooze aplicado' : 'Snooze removido', 'success');
        onChanged?.(target ? target.toISOString() : null);
        setOpen(false);
        setShowCustom(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Erro ao aplicar snooze', 'error');
      }
    } catch {
      toast('Erro de conexão', 'error');
    } finally {
      setBusy(false);
    }
  }

  function handleCustom() {
    if (!customValue) return;
    const d = new Date(customValue);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      toast('Escolha uma data/hora futura', 'warning');
      return;
    }
    void applySnooze(d);
  }

  const presets: { label: string; getDate: () => Date }[] = [
    { label: '1 dia', getDate: () => inDays(1) },
    { label: '3 dias', getDate: () => inDays(3) },
    { label: '1 semana', getDate: () => inDays(7) },
    { label: 'Próxima segunda 9h', getDate: nextMondayAt9 },
  ];

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={isSnoozed ? 'Snoozed — clique pra editar' : 'Snooze este ticket'}
        aria-label="Snooze"
        className={cn(
          'inline-flex items-center justify-center rounded transition-colors',
          compact ? 'h-5 w-5' : 'h-7 w-7',
          isSnoozed
            ? 'text-indigo-400 hover:bg-[var(--overlay-hover)]'
            : 'text-tertiary-muted hover:text-primary hover:bg-[var(--overlay-hover)]'
        )}
      >
        <Moon size={compact ? 12 : 14} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-lg border border-[var(--card-border)] bg-[var(--modal-bg)] p-1 shadow-xl"
        >
          {!showCustom ? (
            <>
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-tertiary-muted">
                Snooze por
              </div>
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={busy}
                  onClick={() => applySnooze(p.getDate())}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-primary hover:bg-[var(--overlay-hover)] disabled:opacity-50"
                >
                  <span>{p.label}</span>
                  <span className="text-[11px] text-tertiary-muted">
                    {p.getDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-primary hover:bg-[var(--overlay-hover)]"
              >
                Personalizado...
              </button>
              {isSnoozed && (
                <>
                  <div className="my-1 border-t border-[var(--card-border)]" />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => applySnooze(null)}
                    className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remover snooze
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="space-y-2 p-2">
              <label className="block text-[11px] font-medium text-secondary-muted">
                Esconder até
              </label>
              <input
                type="datetime-local"
                autoFocus
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="w-full rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-1 text-[13px] text-primary outline-none focus:border-blue-500/50"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustom(false);
                    setCustomValue('');
                  }}
                  className="rounded px-2 py-1 text-[12px] text-secondary-muted hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!customValue || busy}
                  onClick={handleCustom}
                  className="rounded bg-blue-600 px-2 py-1 text-[12px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SnoozedBadge({ snoozedUntil }: { snoozedUntil: string | null | undefined }) {
  const txt = formatBadge(snoozedUntil);
  if (!txt) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[10px] font-medium bg-indigo-500/15 text-indigo-400"
      title={`Snoozed até ${txt}`}
    >
      <Moon size={9} strokeWidth={2} />
      até {txt}
    </span>
  );
}
