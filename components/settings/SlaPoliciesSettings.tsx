'use client';

import { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';

export interface SlaPolicy {
  id: string;
  workspace_id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  hours_to_resolve: number;
  alert_hours_before: number;
  enabled: boolean;
  updated_at?: string | null;
}

interface SlaPoliciesSettingsProps {
  initialPolicies: SlaPolicy[];
}

const PRIORITY_ORDER: SlaPolicy['priority'][] = ['urgent', 'high', 'medium', 'low'];

const priorityLabel: Record<SlaPolicy['priority'], { label: string; dot: string }> = {
  urgent: { label: 'Urgente', dot: 'bg-red-500' },
  high: { label: 'Alta', dot: 'bg-orange-400' },
  medium: { label: 'Média', dot: 'bg-blue-400' },
  low: { label: 'Baixa', dot: 'bg-slate-500' },
};

/** Defaults sensatos — espelha o que o backend usa quando não há policy ainda. */
const defaultPolicy = (priority: SlaPolicy['priority']): SlaPolicy => ({
  id: '',
  workspace_id: '',
  priority,
  hours_to_resolve:
    priority === 'urgent' ? 24 : priority === 'high' ? 168 : priority === 'medium' ? 336 : 720,
  alert_hours_before:
    priority === 'urgent' ? 4 : priority === 'high' ? 24 : priority === 'medium' ? 48 : 72,
  enabled: true,
});

export default function SlaPoliciesSettings({ initialPolicies }: SlaPoliciesSettingsProps) {
  const { toast } = useToast();
  // Garante 4 linhas mesmo se backend ainda não populou alguma priority
  const initialMap = new Map(initialPolicies.map((p) => [p.priority, p]));
  const seeded = PRIORITY_ORDER.map((p) => initialMap.get(p) ?? defaultPolicy(p));

  const [policies, setPolicies] = useState<SlaPolicy[]>(seeded);
  const [savingPriority, setSavingPriority] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  function updatePolicy(priority: SlaPolicy['priority'], patch: Partial<SlaPolicy>) {
    setPolicies((prev) =>
      prev.map((p) => (p.priority === priority ? { ...p, ...patch } : p))
    );
  }

  async function handleSave(priority: SlaPolicy['priority']) {
    const policy = policies.find((p) => p.priority === priority);
    if (!policy) return;

    // Validação client-side espelhando o backend (1..8760)
    if (
      !Number.isFinite(policy.hours_to_resolve) ||
      policy.hours_to_resolve <= 0 ||
      policy.hours_to_resolve > 8760
    ) {
      toast('Horas pra resolver deve ser entre 1 e 8760', 'warning');
      return;
    }
    if (
      !Number.isFinite(policy.alert_hours_before) ||
      policy.alert_hours_before < 0 ||
      policy.alert_hours_before > 8760
    ) {
      toast('Alertar antes deve ser entre 0 e 8760', 'warning');
      return;
    }
    if (policy.alert_hours_before >= policy.hours_to_resolve) {
      toast('Alertar antes precisa ser menor que horas pra resolver', 'warning');
      return;
    }

    setSavingPriority(priority);
    try {
      const res = await fetch(`/api/sla-policies/${priority}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours_to_resolve: policy.hours_to_resolve,
          alert_hours_before: policy.alert_hours_before,
          enabled: policy.enabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Erro ao salvar policy', 'error');
        return;
      }
      const updated = (await res.json()) as SlaPolicy;
      updatePolicy(priority, updated);
      toast('Policy salva', 'success');
      setJustSaved(priority);
      window.setTimeout(() => setJustSaved((cur) => (cur === priority ? null : cur)), 1500);
    } catch {
      toast('Erro de conexão', 'error');
    } finally {
      setSavingPriority(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">SLA Policies</h2>
        <p className="mt-1 text-[12px] text-secondary-muted">
          Configure por prioridade quanto tempo um ticket pode ficar aberto e quando alertar.
          Mudanças se aplicam a tickets criados a partir de agora.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--modal-bg)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--card-border)] bg-[var(--overlay-subtle)] text-left text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">
              <th className="px-4 py-2.5">Prioridade</th>
              <th className="px-4 py-2.5">Horas pra resolver</th>
              <th className="px-4 py-2.5">Alertar antes (horas)</th>
              <th className="px-4 py-2.5">Habilitado</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => {
              const meta = priorityLabel[p.priority];
              const isSaving = savingPriority === p.priority;
              const wasSaved = justSaved === p.priority;
              return (
                <tr
                  key={p.priority}
                  className="border-b border-[var(--card-border)] last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-primary">
                      <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      max={8760}
                      step={1}
                      value={p.hours_to_resolve}
                      onChange={(e) =>
                        updatePolicy(p.priority, {
                          hours_to_resolve: Math.max(1, Math.floor(Number(e.target.value) || 0)),
                        })
                      }
                      disabled={!p.enabled || isSaving}
                      className="w-24 rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-1 text-primary outline-none focus:border-blue-500/50 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={8760}
                      step={1}
                      value={p.alert_hours_before}
                      onChange={(e) =>
                        updatePolicy(p.priority, {
                          alert_hours_before: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        })
                      }
                      disabled={!p.enabled || isSaving}
                      className="w-24 rounded border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-1 text-primary outline-none focus:border-blue-500/50 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.enabled}
                      onClick={() => updatePolicy(p.priority, { enabled: !p.enabled })}
                      disabled={isSaving}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        p.enabled ? 'bg-blue-500' : 'bg-[var(--overlay-hover)]',
                        isSaving && 'opacity-50'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                          p.enabled ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSave(p.priority)}
                      disabled={isSaving}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition',
                        wasSaved
                          ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                          : 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30 hover:bg-blue-500/25',
                        isSaving && 'opacity-50 cursor-wait'
                      )}
                    >
                      {wasSaved ? (
                        <>
                          <Check size={13} strokeWidth={2.5} />
                          Salvo
                        </>
                      ) : isSaving ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                          Salvando
                        </>
                      ) : (
                        <>
                          <Save size={13} />
                          Salvar
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-tertiary-muted">
        Nota: alterar &quot;Horas pra resolver&quot; não recalcula tickets já existentes —
        só afeta novos tickets ou tickets cuja prioridade mudar.
      </p>
    </div>
  );
}
