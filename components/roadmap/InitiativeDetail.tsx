'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Target,
  Rocket,
  TrendingUp,
  Star,
  Flag,
  Trophy,
  Sparkles,
  Zap,
  Check,
  X,
  CalendarClock,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { routes } from '@/lib/utils/nav';
import type { Route } from 'next';
import InitiativeFormModal from './InitiativeFormModal';
import type {
  RoadmapInitiative,
  RoadmapMember,
  RoadmapProject,
  HealthStatus,
} from './RoadmapView';

export interface DetailProjectBreakdown {
  project_id: string;
  name: string;
  prefix: string;
  color: string | null;
  is_archived: boolean;
  weight: number;
  ticket_count: number;
  completed_count: number;
  percentage: number;
}

export interface DetailHealthEvent {
  created_at: string;
  actor_name: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface DetailInitiative {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  health: string;
  health_set_at: string | null;
  health_set_by: string | null;
  health_set_by_name: string | null;
  health_note: string | null;
  start_date: string | null;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  progress: {
    percentage: number;
    completed_tickets: number;
    total_tickets: number;
    projects_count: number;
  };
  projects: DetailProjectBreakdown[];
  health_history: DetailHealthEvent[];
}

export type DetailMember = RoadmapMember;
export type DetailProject = RoadmapProject;

interface Props {
  initiative: DetailInitiative;
  allProjects: DetailProject[];
  members: DetailMember[];
  isAdmin: boolean;
  isOwner: boolean;
}

const HEALTH_LABELS: Record<HealthStatus, string> = {
  on_track: 'No prazo',
  at_risk: 'Em risco',
  off_track: 'Atrasado',
  completed: 'Concluído',
  archived: 'Arquivado',
};

const HEALTH_BADGE: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  at_risk: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  off_track: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  archived: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
};

const HEALTH_BAR: Record<HealthStatus, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-red-500',
  completed: 'bg-blue-500',
  archived: 'bg-zinc-500',
};

const ICON_MAP: Record<string, typeof Target> = {
  target: Target,
  rocket: Rocket,
  'trending-up': TrendingUp,
  star: Star,
  flag: Flag,
  trophy: Trophy,
  sparkles: Sparkles,
  zap: Zap,
};

function isHealth(value: string): value is HealthStatus {
  return value === 'on_track' || value === 'at_risk' || value === 'off_track' || value === 'completed' || value === 'archived';
}

function asHealth(value: string): HealthStatus {
  return isHealth(value) ? value : 'on_track';
}

function renderIcon(iconKey: string | null, size = 18): JSX.Element {
  if (!iconKey) return <Target size={size} />;
  const Comp = ICON_MAP[iconKey.toLowerCase()];
  if (Comp) return <Comp size={size} />;
  return <span className="text-[18px] leading-none">{iconKey}</span>;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InitiativeDetail({
  initiative,
  allProjects,
  members,
  isAdmin,
  isOwner,
}: Props): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [data, setData] = useState<DetailInitiative>(initiative);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [showAddProject, setShowAddProject] = useState<boolean>(false);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState<number>(1);

  const canMutate = isAdmin || isOwner;
  const health = asHealth(data.health);

  const linkedIds = useMemo(() => new Set(data.projects.map((p) => p.project_id)), [data.projects]);
  const availableProjects = useMemo(
    () => allProjects.filter((p) => !linkedIds.has(p.id)),
    [allProjects, linkedIds],
  );

  async function handleAddProject(projectId: string) {
    const res = await fetch(`/api/initiatives/${data.id}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, weight: 1 }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast(err.error ?? 'Erro ao adicionar projeto', 'error');
      return;
    }
    const project = allProjects.find((p) => p.id === projectId);
    if (project) {
      setData((prev) => ({
        ...prev,
        projects: [
          ...prev.projects,
          {
            project_id: project.id,
            name: project.name,
            prefix: project.prefix,
            color: project.color,
            is_archived: false,
            weight: 1,
            ticket_count: 0,
            completed_count: 0,
            percentage: 0,
          },
        ],
      }));
    }
    setShowAddProject(false);
    toast('Projeto adicionado', 'success');
  }

  async function handleRemoveProject(project: DetailProjectBreakdown) {
    const ok = await confirm({
      title: 'Remover vínculo',
      message: `Remover "${project.name}" desta iniciativa? O projeto e seus tickets não serão afetados.`,
      variant: 'warning',
      confirmText: 'Remover',
    });
    if (!ok) return;
    const res = await fetch(
      `/api/initiatives/${data.id}/projects/${project.project_id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      toast('Erro ao remover projeto', 'error');
      return;
    }
    setData((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.project_id !== project.project_id),
    }));
    toast('Projeto removido', 'success');
  }

  async function handleSaveWeight(project: DetailProjectBreakdown) {
    if (weightDraft <= 0 || !Number.isFinite(weightDraft)) {
      toast('Peso deve ser maior que zero', 'error');
      return;
    }
    const res = await fetch(`/api/initiatives/${data.id}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: project.project_id, weight: Math.floor(weightDraft) }),
    });
    if (!res.ok) {
      toast('Erro ao salvar peso', 'error');
      return;
    }
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.project_id === project.project_id ? { ...p, weight: Math.floor(weightDraft) } : p,
      ),
    }));
    setEditingWeightId(null);
    toast('Peso atualizado', 'success');
  }

  function handleSaved(saved: RoadmapInitiative): void {
    // O modal devolve um RoadmapInitiative — mesclamos só os campos editáveis,
    // mantendo health_history e breakdown detalhado (não fornecidos pelo modal).
    setData((prev) => ({
      ...prev,
      name: saved.name,
      description: saved.description,
      goal: saved.goal,
      health: saved.health,
      health_note: saved.health_note,
      start_date: saved.start_date,
      target_date: saved.target_date,
      color: saved.color,
      icon: saved.icon,
      owner_id: saved.owner_id,
      owner_name: saved.owner_name,
      progress: saved.progress,
    }));
  }

  // Para reaproveitar o modal, convertemos breakdown -> projects[] simples
  const initiativeForModal: RoadmapInitiative = {
    ...data,
    projects: data.projects.map((p) => ({
      project_id: p.project_id,
      name: p.name,
      prefix: p.prefix,
      color: p.color,
    })),
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push('/roadmap' as Route)}
        className="inline-flex items-center gap-1.5 text-[12px] text-secondary-muted transition hover:text-primary"
      >
        <ArrowLeft size={13} />
        Voltar pro roadmap
      </button>

      {/* Banner colorido */}
      <div
        className="rounded-xl border border-[var(--card-border)] p-6"
        style={{
          background: `linear-gradient(135deg, ${data.color ?? '#3b6cf5'}22 0%, var(--card-bg) 100%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: data.color ?? '#3b6cf5' }}
            >
              {renderIcon(data.icon, 24)}
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold text-primary leading-tight">{data.name}</h1>
              {data.goal && (
                <p className="mt-1.5 text-[13px] text-secondary-muted">{data.goal}</p>
              )}
              <div className="mt-3 inline-flex items-center gap-2">
                <span className={cn('badge border', HEALTH_BADGE[health])}>
                  {HEALTH_LABELS[health]}
                </span>
                <span className="text-[11.5px] text-tertiary-muted">
                  Atualizada {formatDateTime(data.updated_at)}
                </span>
              </div>
            </div>
          </div>
          {canMutate && (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="btn-premium btn-secondary"
            >
              <Pencil size={13} />
              Editar
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main: projects breakdown */}
        <div className="space-y-4">
          {/* Progress agregado */}
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-secondary-muted">Progresso geral</span>
              <span className="font-semibold text-primary">
                {data.progress.percentage}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--overlay-subtle)]">
              <div
                className={cn('h-full rounded-full transition-all', HEALTH_BAR[health])}
                style={{ width: `${Math.min(100, data.progress.percentage)}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] tabular-nums text-tertiary-muted">
              {data.progress.completed_tickets} de {data.progress.total_tickets} tickets concluídos
              · {data.progress.projects_count} projeto{data.progress.projects_count === 1 ? '' : 's'}
            </p>
          </div>

          {/* Projects */}
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-3">
              <h2 className="text-[14px] font-semibold text-primary">
                Projetos vinculados ({data.projects.length})
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
                        onClick={() => handleAddProject(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 text-[12px] text-primary transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.color ?? '#64748b' }}
                        />
                        {p.name}
                        <span className="font-mono text-[10px] text-tertiary-muted">
                          {p.prefix}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {data.projects.length === 0 ? (
              <div className="px-5 py-8 text-center text-[12.5px] text-tertiary-muted">
                Nenhum projeto vinculado ainda.
                {canMutate && ' Use o botão acima pra adicionar.'}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--card-border)]">
                {data.projects.map((p) => {
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
                            <span className="truncate text-[13px] font-medium text-primary">
                              {p.name}
                            </span>
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
        </div>

        {/* Sidebar direita */}
        <aside className="space-y-4">
          {data.description && (
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
                Descrição
              </h3>
              <p className="text-[12.5px] leading-relaxed text-secondary-muted whitespace-pre-line">
                {data.description}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 text-[12.5px]">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
              Detalhes
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-tertiary-muted">Owner</span>
              <span className="text-primary">{data.owner_name ?? 'Sem owner'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-tertiary-muted">Início</span>
              <span className="text-primary">{formatDate(data.start_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-tertiary-muted">Prazo</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <CalendarClock size={11} className="text-tertiary-muted" />
                {formatDate(data.target_date)}
              </span>
            </div>
          </div>

          {data.health_note && (
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
                Nota do health
              </h3>
              <p className="text-[12.5px] leading-relaxed text-secondary-muted">
                {data.health_note}
              </p>
              {data.health_set_by_name && data.health_set_at && (
                <p className="mt-2 text-[11px] text-tertiary-muted">
                  Por {data.health_set_by_name} em {formatDateTime(data.health_set_at)}
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary-muted">
              Histórico de health
            </h3>
            {data.health_history.length === 0 ? (
              <p className="text-[12px] text-tertiary-muted">Sem mudanças registradas.</p>
            ) : (
              <ul className="space-y-2.5 text-[12px]">
                {data.health_history.map((ev, idx) => {
                  const fromKey = ev.from && isHealth(ev.from) ? ev.from : null;
                  const toKey = ev.to && isHealth(ev.to) ? ev.to : null;
                  return (
                    <li key={`${ev.created_at}-${idx}`} className="leading-snug">
                      <div className="flex items-center gap-1.5">
                        {fromKey && (
                          <span className={cn('badge border', HEALTH_BADGE[fromKey])}>
                            {HEALTH_LABELS[fromKey]}
                          </span>
                        )}
                        <span className="text-tertiary-muted">→</span>
                        {toKey && (
                          <span className={cn('badge border', HEALTH_BADGE[toKey])}>
                            {HEALTH_LABELS[toKey]}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-tertiary-muted">
                        {ev.actor_name ?? 'Sistema'} · {formatDateTime(ev.created_at)}
                      </p>
                      {ev.note && (
                        <p className="mt-0.5 text-secondary-muted italic">"{ev.note}"</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <InitiativeFormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={handleSaved}
        projects={allProjects}
        members={members}
        initiative={initiativeForModal}
      />
    </div>
  );
}
