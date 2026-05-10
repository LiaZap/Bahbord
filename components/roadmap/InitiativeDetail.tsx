'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Route } from 'next';
import InitiativeFormModal from './InitiativeFormModal';
import type { RoadmapInitiative } from './RoadmapView';
import Banner from './initiative-detail/Banner';
import ProjectBreakdown from './initiative-detail/ProjectBreakdown';
import HealthHistory from './initiative-detail/HealthHistory';
import { HEALTH_BAR, asHealth } from './initiative-detail/shared';
import type {
  DetailInitiative,
  DetailMember,
  DetailProject,
  DetailProjectBreakdown,
} from './initiative-detail/types';

// Re-export pra preservar API externa do módulo (callers importam estes
// tipos direto do InitiativeDetail).
export type {
  DetailInitiative,
  DetailMember,
  DetailProject,
  DetailProjectBreakdown,
  DetailHealthEvent,
} from './initiative-detail/types';

interface Props {
  initiative: DetailInitiative;
  allProjects: DetailProject[];
  members: DetailMember[];
  isAdmin: boolean;
  isOwner: boolean;
}

/**
 * Página de detalhe de uma iniciativa do roadmap. Orquestra:
 * - Banner (header colorido + botão Editar)
 * - ProjectBreakdown (lista de projetos vinculados, peso, progresso)
 * - HealthHistory (sidebar com descrição, detalhes e histórico)
 * - InitiativeFormModal (modal de edição)
 *
 * Estado local: cache do `data` da iniciativa pra refletir mutações sem reload.
 */
export default function InitiativeDetail({
  initiative,
  allProjects,
  members,
  isAdmin,
  isOwner,
}: Props): JSX.Element {
  const router = useRouter();

  const [data, setData] = useState<DetailInitiative>(initiative);
  const [showEdit, setShowEdit] = useState<boolean>(false);

  const canMutate = isAdmin || isOwner;
  const health = asHealth(data.health);

  const linkedIds = useMemo(
    () => new Set(data.projects.map((p) => p.project_id)),
    [data.projects],
  );
  const availableProjects = useMemo(
    () => allProjects.filter((p) => !linkedIds.has(p.id)),
    [allProjects, linkedIds],
  );

  function handleAdd(project: DetailProject) {
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

  function handleRemove(projectId: string) {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.project_id !== projectId),
    }));
  }

  function handleUpdateWeight(projectId: string, weight: number) {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.project_id === projectId ? { ...p, weight } : p,
      ),
    }));
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
    projects: data.projects.map((p: DetailProjectBreakdown) => ({
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

      <Banner
        name={data.name}
        goal={data.goal}
        color={data.color}
        icon={data.icon}
        health={health}
        updatedAt={data.updated_at}
        canMutate={canMutate}
        onEdit={() => setShowEdit(true)}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main: progress agregado + projects breakdown */}
        <div className="space-y-4">
          {/* Progress agregado */}
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-secondary-muted">Progresso geral</span>
              <span className="font-semibold text-primary">{data.progress.percentage}%</span>
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

          <ProjectBreakdown
            initiativeId={data.id}
            projects={data.projects}
            availableProjects={availableProjects}
            isAdmin={isAdmin}
            canMutate={canMutate}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onUpdateWeight={handleUpdateWeight}
          />
        </div>

        <HealthHistory
          description={data.description}
          ownerName={data.owner_name}
          startDate={data.start_date}
          targetDate={data.target_date}
          healthNote={data.health_note}
          healthSetByName={data.health_set_by_name}
          healthSetAt={data.health_set_at}
          history={data.health_history}
        />
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
