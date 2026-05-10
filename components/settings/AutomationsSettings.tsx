'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit2, Loader2, Plus, Trash2, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import AutomationFormModal, {
  ACTION_TYPES,
  TRIGGER_EVENTS,
  type Automation,
  type SelectItem,
} from './AutomationFormModal';

interface ProjectRow {
  id: string;
  name: string;
}

function eventLabel(value: string): string {
  return TRIGGER_EVENTS.find((e) => e.value === value)?.label || value;
}

function actionLabel(value: string): string {
  return ACTION_TYPES.find((a) => a.value === value)?.label || value;
}

function describeConditions(conditions: Record<string, unknown> | null): string {
  if (!conditions) return '';
  const entries = Object.entries(conditions);
  if (entries.length === 0) return '';
  return entries
    .map(([key, value]) => {
      const v = typeof value === 'string' ? value : JSON.stringify(value);
      return `${key} = ${v}`;
    })
    .join(' · ');
}

export default function AutomationsSettings() {
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [projects, setProjects] = useState<SelectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      const res = await fetch('/api/automations');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      if (Array.isArray(data)) setAutomations(data as Automation[]);
    } catch {
      toast('Erro ao carregar automações', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/options?type=projects');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(
          (data as ProjectRow[]).map((p) => ({ id: p.id, name: p.name }))
        );
      }
    } catch {
      // silencioso — projetos são opcionais; o select fica vazio
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
    fetchProjects();
  }, [fetchAutomations, fetchProjects]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(a: Automation) {
    setEditing(a);
    setModalOpen(true);
  }

  async function handleToggle(a: Automation) {
    setTogglingId(a.id);
    // Optimistic update
    setAutomations((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, is_active: !a.is_active } : x))
    );
    try {
      const res = await fetch('/api/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
      });
      if (!res.ok) throw new Error('failed');
      toast(
        !a.is_active ? 'Automação ativada' : 'Automação pausada',
        'success'
      );
    } catch {
      // revert
      setAutomations((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, is_active: a.is_active } : x))
      );
      toast('Erro ao alternar automação', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(a: Automation) {
    const ok = await confirm({
      title: 'Remover automação',
      message: `A regra "${a.name}" será removida e parará de executar. Essa ação não pode ser desfeita.`,
      confirmText: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/automations?id=${a.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('failed');
      setAutomations((prev) => prev.filter((x) => x.id !== a.id));
      toast('Automação removida', 'success');
    } catch {
      toast('Erro ao remover automação', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-secondary-muted">
        <Loader2 size={16} className="animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-primary">Automações</h2>
          <p className="text-xs text-secondary-muted">
            Crie regras visuais no formato &quot;Quando · Se · Faça&quot; para automatizar tarefas
            repetitivas (estilo Jira Automation / IFTTT).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn-premium btn-primary flex items-center gap-1.5 text-xs"
        >
          <Plus size={14} />
          Nova automação
        </button>
      </div>

      {/* List */}
      {automations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--overlay-subtle)] px-6 py-10 text-center">
          <Zap size={20} className="mx-auto mb-2 text-tertiary-muted" />
          <p className="text-sm font-medium text-primary">
            Nenhuma automação configurada
          </p>
          <p className="mt-1 text-xs text-secondary-muted">
            Comece automatizando atribuições, prioridades e notificações.
          </p>
          <button
            onClick={openCreate}
            className="btn-premium btn-primary mx-auto mt-4 inline-flex items-center gap-1.5 text-xs"
          >
            <Plus size={14} />
            Criar primeira automação
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {automations.map((a) => {
            const conditionsText = describeConditions(a.trigger_conditions);
            const toggling = togglingId === a.id;
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 transition hover:bg-[var(--overlay-subtle)]"
              >
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle(a)}
                  disabled={toggling}
                  className={
                    'relative mt-1 h-4 w-8 shrink-0 rounded-full transition disabled:opacity-50 ' +
                    (a.is_active ? 'bg-accent' : 'bg-[var(--overlay-hover)]')
                  }
                  title={a.is_active ? 'Pausar automação' : 'Ativar automação'}
                  aria-label={a.is_active ? 'Pausar automação' : 'Ativar automação'}
                >
                  <span
                    className={
                      'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ' +
                      (a.is_active ? 'translate-x-4' : 'translate-x-0.5')
                    }
                  />
                </button>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Zap size={13} className="shrink-0 text-accent" />
                    <p className="truncate text-sm font-medium text-primary">{a.name}</p>
                    {!a.is_active && (
                      <span className="rounded-full border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-tertiary-muted">
                        Pausada
                      </span>
                    )}
                    {a.project_name ? (
                      <span className="rounded-full bg-[var(--overlay-subtle)] px-2 py-0.5 text-[10px] text-secondary-muted">
                        {a.project_name}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--overlay-subtle)] px-2 py-0.5 text-[10px] text-tertiary-muted">
                        Todos os projetos
                      </span>
                    )}
                  </div>

                  {a.description && (
                    <p className="mt-0.5 truncate text-[11px] text-tertiary-muted">
                      {a.description}
                    </p>
                  )}

                  <p className="mt-1.5 text-[12px] leading-relaxed text-secondary-muted">
                    <span className="text-tertiary-muted">Quando</span>{' '}
                    <span className="text-primary">{eventLabel(a.trigger_event)}</span>
                    {conditionsText && (
                      <>
                        {' '}
                        <span className="text-tertiary-muted">se</span>{' '}
                        <span className="text-primary">{conditionsText}</span>
                      </>
                    )}{' '}
                    <span className="text-tertiary-muted">→ faça</span>{' '}
                    <span className="text-primary">{actionLabel(a.action_type)}</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="rounded p-1.5 text-secondary-muted transition hover:bg-[var(--overlay-hover)] hover:text-primary"
                    title="Editar"
                    aria-label="Editar automação"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    className="rounded p-1.5 text-secondary-muted transition hover:bg-red-500/15 hover:text-red-400"
                    title="Remover"
                    aria-label="Remover automação"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal */}
      <AutomationFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAutomations}
        editing={editing}
        projects={projects}
      />
    </div>
  );
}
