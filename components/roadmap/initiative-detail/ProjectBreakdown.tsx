'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { routes } from '@/lib/utils/nav';
import type { DetailProject, DetailProjectBreakdown } from './types';

interface BreakdownProps {
  initiativeId: string;
  projects: DetailProjectBreakdown[];
  availableProjects: DetailProject[];
  isAdmin: boolean;
  canMutate: boolean;
  onAdd: (project: DetailProject) => void;
  onRemove: (projectId: string) => void;
  onUpdateWeight: (projectId: string, weight: number) => void;
}

/**
 * Lista de projetos vinculados à iniciativa, com:
 * - botão pra adicionar projeto (canMutate)
 * - barra de progresso por projeto
 * - edição inline do peso (admin)
 * - remoção (canMutate)
 */
export default function ProjectBreakdown({
  initiativeId,
  projects,
  availableProjects,
  isAdmin,
  canMutate,
  onAdd,
  onRemove,
  onUpdateWeight,
}: BreakdownProps): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [showAddProject, setShowAddProject] = useState<boolean>(false);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState<number>(1);

  async function handleAddProject(project: DetailProject) {
    const res = await fetch(`/api/initiatives/${initiativeId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.id, weight: 1 }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? 'Erro ao adicionar projeto', 'error');
      return;
    }
    onAdd(project);
    setShowAddProject(false);
    toast('Projeto adicionado', 'success');
  }

  async function handleRemoveProject(p: DetailProjectBreakdown) {
    const ok = await confirm({
      title: 'Remover vínculo',
      message: `Remover "${p.name}" desta iniciativa? O projeto e seus tickets não serão afetados.`,
      variant: 'warning',
      confirmText: 'Remover',
    });
    if (!ok) return;
    const res = await fetch(`/api/initiatives/${initiativeId}/projects/${p.project_id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      toast('Erro ao remover projeto', 'error');
      return;
    }
    onRemove(p.project_id);
    toast('Projeto removido', 'success');
  }

  async function handleSaveWeight(p: DetailProjectBreakdown) {
    if (weightDraft <= 0 || !Number.isFinite(weightDraft)) {
      toast('Peso deve ser maior que zero', 'error');
      return;
    }
    const res = await fetch(`/api/initiatives/${initiativeId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: p.project_id, weight: Math.floor(weightDraft) }),
    });
    if (!res.ok) {
      toast('Erro ao salvar peso', 'error');
      return;
    }
    onUpdateWeight(p.project_id, Math.floor(weightDraft));
    setEditingWeightId(null);
    toast('Peso atualizado', 'success');
  }

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-3">
        <h2 className="text-[14px] font-semibold text-primary">
          Projetos vinculados ({projects.length})
        </h2>
        {canMutate && (
          <button
            type="button"
            onClick={() => setShowAddProject((v) => !v)}
            className="btn-premium btn-secondary"
          >
            <Plus size={13} />
            Adicionar projeto
          </button>
        )}
      </div>

      {showAddProject && canMutate && (
        <div className="border-b border-[var(--card-border)] bg-[var(--overlay-subtle)] px-5 py-3">
          {availableProjects.length === 0 ? (
            <p className="text-[12px] text-tertiary-muted">
              Todos os projetos do workspace já estão vinculados.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {availableProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAddProject(p)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[12px] text-primary transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: p.color ?? '#64748b' }}
                  />
                  {p.name}
                  <span className="font-mono text-[10px] text-tertiary-muted">{p.prefix}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-tertiary-muted">
          Nenhum projeto vinculado ainda.
          {canMutate && ' Use o botão acima pra adicionar.'}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--card-border)]">
          {projects.map((p) => {
            const isEditingWeight = editingWeightId === p.project_id;
            return (
              <li
                key={p.project_id}
                className="group flex items-center gap-4 px-5 py-3 transition hover:bg-[var(--overlay-subtle)]"
              >
                <button
                  type="button"
                  onClick={() => router.push(routes.projectSpec(p.project_id))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: p.color ?? '#64748b' }}
                  >
                    {p.prefix.substring(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-primary">{p.name}</span>
                      {p.is_archived && (
                        <span className="badge border border-zinc-500/30 bg-zinc-500/15 text-zinc-600 dark:text-zinc-400">
                          Arquivado
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--overlay-subtle)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${Math.min(100, p.percentage)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-tertiary-muted">
                        {p.completed_count}/{p.ticket_count} · {p.percentage}%
                      </span>
                    </div>
                  </div>
                </button>

                {/* Weight */}
                {isAdmin && isEditingWeight ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={weightDraft}
                      onChange={(e) => setWeightDraft(Number(e.target.value))}
                      className="w-16 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-1 text-[12px] text-primary outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveWeight(p)}
                      className="rounded p-1 text-emerald-600 hover:bg-[var(--overlay-subtle)] dark:text-emerald-400"
                      aria-label="Salvar peso"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingWeightId(null)}
                      className="rounded p-1 text-tertiary-muted hover:bg-[var(--overlay-subtle)]"
                      aria-label="Cancelar"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) return;
                      setEditingWeightId(p.project_id);
                      setWeightDraft(p.weight);
                    }}
                    className={cn(
                      'rounded-md px-2 py-1 text-[11px] tabular-nums',
                      isAdmin
                        ? 'cursor-pointer text-secondary-muted hover:bg-[var(--overlay-subtle)] hover:text-primary'
                        : 'text-tertiary-muted',
                    )}
                    title={isAdmin ? 'Clique pra ajustar peso' : 'Peso (somente leitura)'}
                    aria-label="Peso do projeto"
                  >
                    peso {p.weight}
                  </button>
                )}

                {canMutate && (
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(p)}
                    className="rounded p-1.5 text-tertiary-muted opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                    title="Remover do roadmap"
                    aria-label="Remover projeto"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
