'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';
import type { Route } from 'next';
import InitiativeFormModal from './InitiativeFormModal';
import InitiativeCard, { asHealth } from './InitiativeCard';
import RoadmapFilters, { type HealthFilter } from './RoadmapFilters';

// ─────────────────────────────────────────────────────────────────────────────
// Types públicos (importados por InitiativeDetail e por sub-componentes).
// Mantemos a definição neste arquivo pra preservar a API externa do módulo.
// ─────────────────────────────────────────────────────────────────────────────

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

const HEALTH_SEVERITY: Record<HealthStatus, number> = {
  off_track: 0,
  at_risk: 1,
  on_track: 2,
  completed: 3,
  archived: 4,
};

/**
 * Lista principal de iniciativas do roadmap. Orquestra:
 * - filtros (chips de health, mostrar arquivadas, filtro por projeto via URL)
 * - lista de InitiativeCard
 * - InitiativeFormModal pra criar/editar
 */
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
    router.replace('/roadmap' as Route);
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

      <RoadmapFilters
        healthFilter={healthFilter}
        showArchived={showArchived}
        projectFilterName={projectFilterName}
        onChangeHealthFilter={setHealthFilter}
        onChangeShowArchived={setShowArchived}
        onClearProjectFilter={clearProjectFilter}
      />

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
          {filtered.map((initiative) => (
            <InitiativeCard
              key={initiative.id}
              initiative={initiative}
              isAdmin={isAdmin}
              editable={canEdit(initiative)}
              onEdit={() => {
                setEditing(initiative);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(initiative)}
            />
          ))}
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
