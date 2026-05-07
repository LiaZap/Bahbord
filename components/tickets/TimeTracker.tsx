'use client';

import { useState, useEffect } from 'react';
import { Play, Square, Clock, Trash2, Plus } from 'lucide-react';
import { useTimeTracking, formatDuration, formatMinutes } from '@/lib/hooks/useTimeTracking';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';

interface TimeTrackerProps {
  ticketId: string;
}

function parseTimeInput(value: string): number | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (/^\d+min$/.test(v)) return parseInt(v, 10);
  let m = v.match(/^(\d+)h\s*(\d+)?(min)?$/);
  if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  m = v.match(/^(\d+):(\d+)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
}

export default function TimeTracker({ ticketId }: TimeTrackerProps) {
  const { entries, runningEntry, elapsed, totalMinutes, billableMinutes, nonBillableMinutes, startTimer, stopTimer, deleteEntry, editEntry, logManualEntry } = useTimeTracking(ticketId);
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualDescription, setManualDescription] = useState('');
  const [manualBillable, setManualBillable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then((data) => {
      const role = data?.member?.role;
      setIsAdmin(role === 'owner' || role === 'admin');
      setMeId(data?.member?.id ?? null);
    }).catch(() => {});
  }, []);

  async function handleSaveEdit(id: string) {
    const minutes = parseTimeInput(editValue);
    if (minutes === null || minutes < 0) {
      setEditingId(null);
      return;
    }
    try {
      await editEntry(id, minutes);
      toast('Tempo atualizado', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error');
    }
    setEditingId(null);
  }

  async function handleDeleteEntry(id: string) {
    const ok = await confirm({
      title: 'Remover registro',
      message: 'Tem certeza que deseja remover este registro de tempo?',
      confirmText: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteEntry(id);
      toast('Registro removido', 'success');
    } catch {
      toast('Erro ao remover', 'error');
    }
  }

  async function handleManualSubmit() {
    const totalMin = manualHours * 60 + manualMinutes;
    if (totalMin <= 0) {
      toast('Duração deve ser maior que zero', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await logManualEntry(totalMin, manualDescription, manualBillable);
      toast('Tempo registrado', 'success');
      setShowManualForm(false);
      setManualHours(0);
      setManualMinutes(30);
      setManualDescription('');
      setManualBillable(true);
    } catch (err) {
      toast(err instanceof Error ? `Erro: ${err.message}` : 'Erro ao registrar', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Time Tracking */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Clock size={13} />
          Time Tracking
        </h3>

        <div className="flex items-center gap-2">
          {runningEntry ? (
            <>
              <span className="font-mono text-lg font-bold text-accent">
                {formatDuration(elapsed)}
              </span>
              <button
                onClick={stopTimer}
                className="flex items-center gap-1.5 rounded bg-danger/20 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/30"
              >
                <Square size={12} fill="currentColor" />
                Parar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startTimer}
                className="flex items-center gap-1.5 rounded bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/30"
              >
                <Play size={12} fill="currentColor" />
                Iniciar
              </button>
              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className="flex items-center gap-1.5 rounded bg-slate-700/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
              >
                <Plus size={12} />
                Registrar tempo
              </button>
            </>
          )}
        </div>

        {/* Manual entry form */}
        {showManualForm && (
          <div className="mt-3 space-y-2 rounded-md border border-border/30 bg-surface p-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={manualHours}
                  onChange={(e) => setManualHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-14 rounded border border-border/40 bg-input px-2 py-1 text-center text-xs text-white"
                />
                <span className="text-[11px] text-slate-500">h</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-14 rounded border border-border/40 bg-input px-2 py-1 text-center text-xs text-white"
                />
                <span className="text-[11px] text-slate-500">min</span>
              </div>
            </div>
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              className="w-full rounded border border-border/40 bg-input px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualBillable}
                  onChange={(e) => setManualBillable(e.target.checked)}
                  className="h-3 w-3 rounded border-slate-600 accent-accent"
                />
                Hora efetiva (cobrável)
              </label>
              <button
                onClick={handleManualSubmit}
                disabled={submitting}
                className="rounded bg-accent/20 px-3 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/30 disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timesheet */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Clock size={13} />
          Timesheet
        </h3>
        <p className="text-sm font-medium text-slate-300">
          Total: <span className="text-white">{formatMinutes(totalMinutes)}</span>
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px]">
          <span className="text-emerald-400">
            Efetivas: {formatMinutes(billableMinutes)}
          </span>
          <span className="text-slate-500">
            Não cobradas: {formatMinutes(nonBillableMinutes)}
          </span>
        </div>
        {entries.length > 0 && (
          <div className="mt-2 max-h-32 space-y-1 overflow-auto">
            {entries.filter((e) => !e.is_running).map((e) => (
              <div key={e.id} className="group flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  {new Date(e.started_at).toLocaleDateString('pt-BR')}
                </span>
                {e.is_billable ? (
                  <span className="rounded px-1 text-[10px] font-semibold text-emerald-400" title="Hora efetiva">
                    R$
                  </span>
                ) : (
                  <span className="rounded px-1 text-[10px] font-semibold text-slate-600 line-through" title="Não cobrada">
                    R$
                  </span>
                )}
                <span className="text-slate-400">{e.member_name}</span>
                {editingId === e.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(ev) => setEditValue(ev.target.value)}
                    onBlur={() => handleSaveEdit(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') handleSaveEdit(e.id);
                      if (ev.key === 'Escape') setEditingId(null);
                    }}
                    placeholder="1h30"
                    className="w-16 rounded border border-[var(--accent)]/40 bg-[var(--bg-input)] px-1 py-0.5 text-right text-[11px] text-primary outline-none"
                  />
                ) : (() => {
                  const canEdit = isAdmin || (!!meId && e.member_id === meId);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return;
                        setEditingId(e.id);
                        setEditValue(String(e.duration_minutes || 0));
                      }}
                      disabled={!canEdit}
                      className={`font-medium tabular-nums ${
                        canEdit ? 'text-slate-300 hover:text-primary hover:underline cursor-pointer' : 'text-slate-300 cursor-default'
                      }`}
                      title={canEdit ? 'Clique para editar (ex: 1h30, 90, 1:30)' : ''}
                    >
                      {formatMinutes(e.duration_minutes || 0)}
                    </button>
                  );
                })()}
                <button
                  onClick={() => handleDeleteEntry(e.id)}
                  className="shrink-0 opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 size={11} className="text-slate-600 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
