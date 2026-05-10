'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import type {
  MeData,
  WorkloadResponse,
} from '@/components/reports/workload/types';

interface UseWorkloadDataParams {
  appliedFrom: string;
  appliedTo: string;
  projectId: string;
  onlyMe: boolean;
  meId: string | null;
}

interface UseWorkloadDataResult {
  data: WorkloadResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Encapsula o fetch de /api/reports/workload, montando a query string a partir
 * dos filtros aplicados. Retorna estado de loading/erro e um `reload` manual.
 */
export function useWorkloadData({
  appliedFrom,
  appliedTo,
  projectId,
  onlyMe,
  meId,
}: UseWorkloadDataParams): UseWorkloadDataResult {
  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('period_from', appliedFrom);
    sp.set('period_to', appliedTo);
    if (projectId) sp.set('project_id', projectId);
    if (onlyMe && meId) sp.set('member_ids', meId);
    return sp.toString();
  }, [appliedFrom, appliedTo, projectId, onlyMe, meId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/workload?${queryString}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: string })?.error || `Erro ${res.status} ao carregar carga`;
        setError(msg);
        toast(msg, 'error');
        setData(null);
        return;
      }
      const json = (await res.json()) as WorkloadResponse;
      setData(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar carga de trabalho';
      setError(msg);
      toast(msg, 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, reload: loadData };
}

/**
 * Carrega o membro logado uma única vez. Usado pelo toggle "Apenas eu".
 */
export function useMe(): MeData | null {
  const [me, setMe] = useState<MeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.member) setMe(json.member as MeData);
      } catch {
        /* silent */
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  return me;
}
