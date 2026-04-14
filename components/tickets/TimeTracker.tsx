'use client';

import { Play, Square, Clock, Trash2 } from 'lucide-react';
import { useTimeTracking, formatDuration, formatMinutes } from '@/lib/hooks/useTimeTracking';
import { useToast } from '@/components/ui/Toast';

interface TimeTrackerProps {
  ticketId: string;
}

export default function TimeTracker({ ticketId }: TimeTrackerProps) {
  const { entries, runningEntry, elapsed, totalMinutes, startTimer, stopTimer, deleteEntry } = useTimeTracking(ticketId);
  const { toast } = useToast();

  async function handleDeleteEntry(id: string) {
    if (!confirm('Remover este registro de tempo?')) return;
    try {
      await deleteEntry(id);
      toast('Registro removido', 'success');
    } catch {
      toast('Erro ao remover', 'error');
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

        {runningEntry ? (
          <div className="flex items-center gap-3">
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
          </div>
        ) : (
          <button
            onClick={startTimer}
            className="flex items-center gap-1.5 rounded bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/30"
          >
            <Play size={12} fill="currentColor" />
            Iniciar
          </button>
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
        {entries.length > 0 && (
          <div className="mt-2 max-h-32 space-y-1 overflow-auto">
            {entries.filter((e) => !e.is_running).map((e) => (
              <div key={e.id} className="group flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  {new Date(e.started_at).toLocaleDateString('pt-BR')}
                </span>
                <span className="text-slate-400">{e.member_name}</span>
                <span className="font-medium text-slate-300">
                  {formatMinutes(e.duration_minutes || 0)}
                </span>
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
