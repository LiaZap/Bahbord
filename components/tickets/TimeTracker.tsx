'use client';

import { Play, Square, Clock } from 'lucide-react';
import { useTimeTracking, formatDuration, formatMinutes } from '@/lib/hooks/useTimeTracking';

interface TimeTrackerProps {
  ticketId: string;
}

export default function TimeTracker({ ticketId }: TimeTrackerProps) {
  const { entries, runningEntry, elapsed, totalMinutes, startTimer, stopTimer } = useTimeTracking(ticketId);

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
              <div key={e.id} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  {new Date(e.started_at).toLocaleDateString('pt-BR')}
                </span>
                <span className="text-slate-400">{e.member_name}</span>
                <span className="font-medium text-slate-300">
                  {formatMinutes(e.duration_minutes || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
