'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Clock, User, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TimeEntry {
  id: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  is_running: boolean;
  is_billable: boolean;
  member_name: string;
  ticket_key: string;
  ticket_title: string;
}

interface MemberSummary {
  member_name: string;
  total_minutes: number;
  billable_minutes: number;
  non_billable_minutes: number;
  entry_count: number;
}

type Period = '7' | '14' | '30';
type BillableFilter = 'all' | 'billable' | 'non_billable';

export default function TimesheetView() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get('board_id');
  const projectIdParam = searchParams.get('project_id');

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<MemberSummary[]>([]);
  const [period, setPeriod] = useState<Period>('7');
  const [billableFilter, setBillableFilter] = useState<BillableFilter>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve project_id a partir do board_id se necessário
      let projectId = projectIdParam;
      if (!projectId && boardId) {
        try {
          const bRes = await fetch('/api/options?type=boards');
          if (bRes.ok) {
            const allBoards = await bRes.json();
            const match = allBoards.find((b: { id: string; project_id: string }) => b.id === boardId);
            if (match?.project_id) projectId = match.project_id;
          }
        } catch {}
      }

      const params = new URLSearchParams({ period });
      if (projectId) params.set('project_id', projectId);
      else if (boardId) params.set('board_id', boardId);

      const res = await fetch(`/api/timesheet?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setSummary(data.summary);
      }
    } catch (err) { console.error('Erro ao carregar timesheet:', err); }
    finally { setLoading(false); }
  }, [period, boardId, projectIdParam]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function formatMin(m: number): string {
    const h = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    if (h === 0) return `${rest}min`;
    return rest > 0 ? `${h}h ${rest}min` : `${h}h`;
  }

  const totalMinutes = summary.reduce((sum, s) => sum + s.total_minutes, 0);
  const totalBillable = summary.reduce((sum, s) => sum + (s.billable_minutes || 0), 0);
  const totalNonBillable = summary.reduce((sum, s) => sum + (s.non_billable_minutes || 0), 0);

  const filteredEntries = entries.filter((e) => {
    if (billableFilter === 'billable') return e.is_billable;
    if (billableFilter === 'non_billable') return !e.is_billable;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Timesheet</h1>
          <p className="mt-1 text-sm text-slate-500">
            Total: <span className="font-medium text-white">{formatMin(totalMinutes)}</span> nos ultimos {period} dias
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Billable filter */}
          <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-surface p-0.5">
            {([
              { key: 'all' as BillableFilter, label: 'Todas' },
              { key: 'billable' as BillableFilter, label: 'Efetivas' },
              { key: 'non_billable' as BillableFilter, label: 'Nao cobradas' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setBillableFilter(key)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition',
                  billableFilter === key ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Period filter */}
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
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Billable summary cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/20 bg-surface2 p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <DollarSign size={14} />
                <span className="text-xs font-semibold uppercase tracking-wider">Horas Efetivas</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{formatMin(totalBillable)}</p>
            </div>
            <div className="rounded-lg border border-slate-600/30 bg-surface2 p-4">
              <div className="flex items-center gap-2 text-slate-500">
                <DollarSign size={14} className="line-through" />
                <span className="text-xs font-semibold uppercase tracking-wider">Nao Cobradas</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{formatMin(totalNonBillable)}</p>
            </div>
          </div>

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
                  <div className="mt-1 flex items-center gap-3 text-[11px]">
                    <span className="text-emerald-400">Efetivas: {formatMin(s.billable_minutes || 0)}</span>
                    <span className="text-slate-500">Nao cobradas: {formatMin(s.non_billable_minutes || 0)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{s.entry_count} registro{s.entry_count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}

          {/* Entries table */}
          <div className="rounded-lg border border-border/40 bg-surface2 overflow-hidden">
            <div className="flex items-center border-b border-border/40 bg-sidebar px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span className="w-28 shrink-0">Data</span>
              <span className="w-24 shrink-0">Ticket</span>
              <span className="flex-1">Titulo</span>
              <span className="w-28 shrink-0">Membro</span>
              <span className="w-12 shrink-0 text-center">Tipo</span>
              <span className="w-20 shrink-0 text-right">Duracao</span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Nenhum registro de tempo neste periodo.
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {filteredEntries.map((e) => (
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
                    <span className="w-12 shrink-0 text-center">
                      {e.is_billable ? (
                        <span className="text-[10px] font-semibold text-emerald-400" title="Hora efetiva">R$</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-600 line-through" title="Nao cobrada">R$</span>
                      )}
                    </span>
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
