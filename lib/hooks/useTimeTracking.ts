'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TimeEntry {
  id: string;
  description: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  is_running: boolean;
  is_billable: boolean;
  member_id: string | null;
  member_name: string;
}

export function useTimeTracking(ticketId: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runningEntry = entries.find((e) => e.is_running);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/time-entries?ticket_id=${ticketId}`);
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch (err) {
      console.error('Erro ao carregar time entries:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Timer ao vivo
  useEffect(() => {
    if (runningEntry) {
      const start = new Date(runningEntry.started_at).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [runningEntry]);

  const startTimer = useCallback(async () => {
    await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId, action: 'start' }),
    });
    await fetchEntries();
  }, [ticketId, fetchEntries]);

  const stopTimer = useCallback(async () => {
    await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId, action: 'stop' }),
    });
    await fetchEntries();
  }, [ticketId, fetchEntries]);

  const totalMinutes = entries.reduce((sum, e) => {
    if (e.is_running) {
      return sum + Math.floor(elapsed / 60);
    }
    return sum + (e.duration_minutes || 0);
  }, 0);

  const billableMinutes = entries.reduce((sum, e) => {
    if (e.is_running) return sum;
    if (e.is_billable) return sum + (e.duration_minutes || 0);
    return sum;
  }, 0);

  const nonBillableMinutes = entries.reduce((sum, e) => {
    if (e.is_running) return sum;
    if (!e.is_billable) return sum + (e.duration_minutes || 0);
    return sum;
  }, 0);

  const logManualEntry = useCallback(async (durationMinutes: number, description: string, isBillable: boolean) => {
    const res = await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticketId,
        action: 'log',
        duration_minutes: durationMinutes,
        description,
        is_billable: isBillable,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await fetchEntries();
  }, [ticketId, fetchEntries]);

  const deleteEntry = useCallback(async (entryId: string) => {
    await fetch(`/api/time-entries?id=${entryId}`, { method: 'DELETE' });
    await fetchEntries();
  }, [fetchEntries]);

  const editEntry = useCallback(async (entryId: string, durationMinutes: number) => {
    const res = await fetch('/api/time-entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entryId, duration_minutes: durationMinutes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    await fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, runningEntry, elapsed, totalMinutes, billableMinutes, nonBillableMinutes, startTimer, stopTimer, deleteEntry, editEntry, logManualEntry, refetch: fetchEntries };
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}
