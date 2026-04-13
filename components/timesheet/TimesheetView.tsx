'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TimeEntry {
  id: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  is_running: boolean;
  member_name: string;
  ticket_key: string;
  ticket_title: string;
}

interface MemberSummary {
  member_name: string;
  total_minutes: number;
  entry_count: number;
}

type Period = '7' | '14' | '30';

export default function TimesheetView() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<MemberSummary[]>([]);
  const [period, setPeriod] = useState<Period>('7');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/timesheet?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setSummary(data.summary);
      }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function formatMin(m: number): string {
    const h = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    if (h === 0) return `${rest}min`;
    return rest > 0 ? `${h}h ${rest}min` : `${h}h`;
  }

  const totalMinutes = summary.reduce((sum, s) => sum + s.total_minutes, 0);

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Timesheet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Total: <span className="font-medium text-white">{formatMin(totalMinutes)}</span> nos últimos {period} dias
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-surface p-0.5">
          {(['7', '14', '30'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition',
                period === p ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Summary by member */}
          {summary.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.map((s) => (
                <div key={s.member_name} className="rounded-lg border border-border/40 bg-surface2 p-4">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-200">{s.member_name}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{formatMin(s.total_minutes)}</p>
                  <p className="text-[11px] text-slate-500">{s.entry_count} registro{s.entry_count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}

          {/* Entries table */}
          <div className="rounded-lg border border-border/40 bg-surface2 overflow-hidden">
            <div className="flex items-center border-b border-border/40 bg-sidebar px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span className="w-28 shrink-0">Data</span>
              <span className="w-24 shrink-0">Ticket</span>
              <span className="flex-1">Título</span>
              <span className="w-28 shrink-0">Membro</span>
              <span className="w-20 shrink-0 text-right">Duração</span>
            </div>

            {entries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Nenhum registro de tempo neste período.
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center px-4 py-2.5 transition hover:bg-input/20">
                    <span className="w-28 shrink-0 text-[11px] text-slate-500">
                      {new Date(e.started_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="w-24 shrink-0">
                      {e.ticket_key ? (
                        <Link href={`/ticket/${e.ticket_key}`} className="font-mono text-[11px] text-accent hover:underline">
                          {e.ticket_key}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-slate-600">-</span>
                      )}
                    </span>
                    <span className="flex-1 truncate pr-3 text-xs text-slate-300">{e.ticket_title || '-'}</span>
                    <span className="w-28 shrink-0 text-[11px] text-slate-400">{e.member_name}</span>
                    <span className="w-20 shrink-0 text-right text-xs font-medium text-slate-300">
                      {e.is_running ? (
                        <span className="flex items-center justify-end gap-1 text-accent">
                          <Clock size={11} className="animate-pulse" />
                          Rodando
                        </span>
                      ) : (
                        formatMin(e.duration_minutes || 0)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
