'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  Target,
  Rocket,
  TrendingUp,
  Star,
  Flag,
  Trophy,
  Sparkles,
  Zap,
  CalendarClock,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';
import InitiativeFormModal from './InitiativeFormModal';

export type HealthStatus = 'on_track' | 'at_risk' | 'off_track' | 'completed' | 'archived';

export interface RoadmapProgress {
  percentage: number;
  completed_tickets: number;
  total_tickets: number;
  projects_count: number;
}

export interface RoadmapProjectRef {
  project_id: string;
  name: string;
  prefix: string;
  color: string | null;
}

export interface RoadmapInitiative {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  health: string;
  health_set_at: string | null;
  health_set_by: string | null;
  health_note: string | null;
  start_date: string | null;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  progress: RoadmapProgress;
  projects: RoadmapProjectRef[];
}

export interface RoadmapProject {
  id: string;
  name: string;
  prefix: string;
  color: string | null;
}

export interface RoadmapMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface Props {
  initialInitiatives: RoadmapInitiative[];
  projects: RoadmapProject[];
  members: RoadmapMember[];
  isAdmin: boolean;
  currentMemberId: string;
}

type HealthFilter = 'all' | HealthStatus;

const HEALTH_LABELS: Record<HealthStatus, string> = {
  on_track: 'No prazo',
  at_risk: 'Em risco',
  off_track: 'Atrasado',
  completed: 'Concluído',
  archived: 'Arquivado',
};

// Tokens semânticos pra evitar contraste ruim no light mode.
// Usamos cores Tailwind soft + texto saturado pra legibilidade nos dois temas.
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

const HEALTH_SEVERITY: Record<HealthStatus, number> = {
  off_track: 0,
  at_risk: 1,
  on_track: 2,
  completed: 3,
  archived: 4,
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

function isHealthStatus(value: string): value is HealthStatus {
  return value === 'on_track' || value === 'at_risk' || value === 'off_track' || value === 'completed' || value === 'archived';
}

function asHealth(value: string): HealthStatus {
  return isHealthStatus(value) ? value : 'on_track';
}

function relativeDate(target: string | null): string | null {
  if (!target) return null;
  const t = new Date(target);
  if (isNaN(t.getTime())) return null;
  const now = new Date();
  const ms = t.getTime() - now.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'vence hoje';
  if (days > 0) {
    if (days === 1) return 'vence amanhã';
    if (days < 30) return `vence em ${days} dias`;
    if (days < 365) {
      const months = Math.round(days / 30);
      return months === 1 ? 'vence em 1 mês' : `vence em ${months} meses`;
    }
    return `vence em ${Math.round(days / 365)} ano(s)`;
  }
  const past = -days;
  if (past === 1) return 'atrasou há 1 dia';
  if (past < 30) return `atrasou há ${past} dias`;
  if (past < 365) {
    const months = Math.round(past / 30);
    return months === 1 ? 'atrasou há 1 mês' : `atrasou há ${months} meses`;
  }
  return `atrasou há ${Math.round(past / 365)} ano(s)`;
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

function colorFromName(name: string): string {
  const palette = ['#3b6cf5', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function renderIcon(iconKey: string | null, size = 16): JSX.Element {
  if (!iconKey) return <Target size={size} />;
  const Comp = ICON_MAP[iconKey.toLowerCase()];
  if (Comp) return <Comp size={size} />;
  // Provavelmente é um emoji — renderiza como texto
  return <span className="text-[15px] leading-none">{iconKey}</span>;
}

export default function RoadmapView({
  initialInitiatives,
  projects,
  members,
  isAdmin,
  currentMemberId,
}: Props): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectFilterParam = searchParams.get('project_id');

  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [initiatives, setInitiatives] = useState<RoadmapInitiative[]>(initialInitiatives);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editing, setEditing] = useState<RoadmapInitiative | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Re-fetch quando o usuário muda o filtro "Mostrar arquivadas" — server filtra
  // archived/completed por padrão, então precisamos re-buscar pra incluí-los.
  useEffect(() => {
    let cancelled = false;
    async function reload() {
      setLoading(true);
      try {
        const url = showArchived
          ? '/api/initiatives?include_archived=true'
          : '/api/initiatives';
        const res = await fetch(url);
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as RoadmapInitiative[];
        if (!cancelled) setInitiatives(data);
      } catch {
        if (!cancelled) toast('Erro ao recarregar iniciativas', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    // Skip primeiro render — initialInitiatives já vem do server.
    if (showArchived) reload();
    return () => {
      cancelled = true;
    };
  }, [showArchived, toast]);

  const filtered = useMemo(() => {
    let list = [...initiatives];
    if (healthFilter !== 'all') {
      list = list.filter((i) => i.health === healthFilter);
    }
    if (projectFilterParam) {
      list = list.filter((i) => i.projects.some((p) => p.project_id === projectFilterParam));
    }
    list.sort((a, b) => {
      const sevA = HEALTH_SEVERITY[asHealth(a.health)] ?? 99;
      const sevB = HEALTH_SEVERITY[asHealth(b.health)] ?? 99;
      if (sevA !== sevB) return sevA - sevB;
      const ta = a.target_date ? new Date(a.target_date).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.target_date ? new Date(b.target_date).getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [initiatives, healthFilter, projectFilterParam]);

  const projectFilterName = useMemo(() => {
    if (!projectFilterParam) return null;
    return projects.find((p) => p.id === projectFilterParam)?.name ?? null;
  }, [projectFilterParam, projects]);

  function clearProjectFilter() {
    router.replace('/roadmap' as never);
  }

  const handleSaved = useCallback((saved: RoadmapInitiative) => {
    setInitiatives((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const copy = prev.slice();
      copy[idx] = saved;
      return copy;
    });
  }, []);

  async function handleDelete(initiative: RoadmapInitiative) {
    const ok = await confirm({
      title: 'Excluir iniciativa',
      message: `Excluir "${initiative.name}"? Os projetos vinculados não serão afetados, mas o histórico de health será perdido.`,
      variant: 'danger',
      confirmText: 'Excluir',
    });
    if (!ok) return;
    const res = await fetch(`/api/initiatives/${initiative.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast('Erro ao excluir', 'error');
      return;
    }
    setInitiatives((prev) => prev.filter((i) => i.id !== initiative.id));
    toast('Iniciativa excluída', 'success');
  }

  function canEdit(initiative: RoadmapInitiative): boolean {
    return isAdmin || initiative.owner_id === currentMemberId;
  }

  const filterChips: Array<{ key: HealthFilter; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'on_track', label: 'No prazo' },
    { key: 'at_risk', label: 'Em risco' },
    { key: 'off_track', label: 'Atrasado' },
    { key: 'completed', label: 'Concluído' },
  ];

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.08em] text-tertiary-muted">
            Workspace · {filtered.length} iniciativa{filtered.length === 1 ? '' : 's'}
          </p>
          <h1 className="text-[24px] font-semibold text-primary leading-tight">Roadmap</h1>
          <p className="text-[13px] text-secondary-muted">
            Iniciativas estratégicas e seus projetos.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="btn-premium btn-primary"
          >
            <Plus size={13} strokeWidth={2.5} />
            Nova iniciativa
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setHealthFilter(chip.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-[12px] font-medium transition',
                healthFilter === chip.key
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--card-border)] text-secondary-muted hover:bg-[var(--overlay-subtle)] hover:text-primary',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12px] text-secondary-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-[var(--card-border)]"
          />
          Mostrar arquivadas
        </label>
        {projectFilterName && (
          <div className="ml-auto flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2.5 py-1 text-[12px] text-secondary-muted">
            <span>
              Projeto: <span className="text-primary font-medium">{projectFilterName}</span>
            </span>
            <button
              type="button"
              onClick={clearProjectFilter}
              className="text-tertiary-muted hover:text-primary"
              aria-label="Limpar filtro"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration="no-projects"
          title="Nenhuma iniciativa"
          description={
            projectFilterName
              ? 'Nenhuma iniciativa contém esse projeto. Ajuste os filtros ou crie uma nova.'
              : 'Crie sua primeira iniciativa pra agrupar projetos sob uma meta estratégica.'
          }
          actions={
            isAdmin
              ? [
                  {
                    label: 'Nova iniciativa',
                    onClick: () => {
                      setEditing(null);
                      setShowForm(true);
                    },
                    variant: 'primary',
                  },
                ]
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((initiative) => {
            const health = asHealth(initiative.health);
            const rel = relativeDate(initiative.target_date);
            const editable = canEdit(initiative);
            return (
              <div
                key={initiative.id}
                onClick={() => router.push(`/roadmap/${initiative.id}` as never)}
                className="card-premium group cursor-pointer p-5 transition"
              >
                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: initiative.color ?? '#3b6cf5' }}
                  >
                    {renderIcon(initiative.icon, 18)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-primary truncate">
                        {initiative.name}
                      </h3>
                      <span
                        className={cn(
                          'badge border',
                          HEALTH_BADGE[health],
                        )}
                      >
                        {HEALTH_LABELS[health]}
                      </span>
                    </div>
                    {(initiative.goal || initiative.description) && (
                      <p className="mt-1 line-clamp-2 text-[12.5px] text-secondary-muted">
                        {initiative.goal ?? initiative.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    {editable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(initiative);
                          setShowForm(true);
                        }}
                        className="rounded p-1.5 text-tertiary-muted transition hover:text-[var(--accent)]"
                        title="Editar"
                        aria-label="Editar iniciativa"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(initiative);
                        }}
                        className="rounded p-1.5 text-tertiary-muted transition hover:text-red-500"
                        title="Excluir"
                        aria-label="Excluir iniciativa"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11.5px] tabular-nums text-secondary-muted">
                    <span>
                      {initiative.progress.completed_tickets} / {initiative.progress.total_tickets} tickets
                    </span>
                    <span className="font-medium text-primary">
                      {initiative.progress.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--overlay-subtle)]">
                    <div
                      className={cn('h-full rounded-full transition-all', HEALTH_BAR[health])}
                      style={{ width: `${Math.min(100, initiative.progress.percentage)}%` }}
                    />
                  </div>
                </div>

                {/* Projects pills */}
                {initiative.projects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {initiative.projects.map((p) => (
                      <button
                        key={p.project_id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/roadmap?project_id=${p.project_id}` as never);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--overlay-subtle)] px-2 py-0.5 text-[11px] font-medium text-secondary-muted transition hover:text-primary"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: p.color ?? '#64748b' }}
                        />
                        {p.name}
                        <span className="font-mono text-[9.5px] text-tertiary-muted">
                          {p.prefix}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-tertiary-muted">
                  <div className="flex items-center gap-3">
                    {rel && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={11} />
                        {rel}
                      </span>
                    )}
                    {!rel && (
                      <span className="inline-flex items-center gap-1 text-tertiary-muted">
                        <CalendarClock size={11} />
                        sem prazo
                      </span>
                    )}
                  </div>
                  {initiative.owner_name ? (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[9.5px] font-bold text-white"
                        style={{ backgroundColor: colorFromName(initiative.owner_name) }}
                      >
                        {getInitials(initiative.owner_name)}
                      </div>
                      <span>{initiative.owner_name}</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon size={11} />
                      sem owner
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InitiativeFormModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
        projects={projects}
        members={members}
        initiative={editing}
      />
    </div>
  );
}
