'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';
import ProjectUpdateCard from './ProjectUpdateCard';

export interface ProjectStatusSummary {
  period: { from: string; to: string };
  metrics: {
    completed_count: number;
    created_count: number;
    overdue_count: number;
    priority_increased_count: number;
    avg_resolution_hours: number | null;
  };
  highlights: string[];
  risks: Array<{
    severity: 'high' | 'medium' | 'low';
    description: string;
    ticket_keys?: string[];
  }>;
  blockers: Array<{ ticket_key: string; title: string; reason: string }>;
  summary: string;
  next_focus: string;
  generated_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  workspace_id: string;
  period_from: string;
  period_to: string;
  /** JSONB do banco — pode vir como ProjectStatusSummary OU fallback minimal. */
  ai_summary: unknown;
  pm_notes: string | null;
  generated_at: string;
  generated_by_cron: boolean;
  pm_completed_at: string | null;
  pm_completed_by: string | null;
  pm_completed_by_name: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  projectPrefix?: string;
  initialUpdates: ProjectUpdate[];
  currentUserIsAdmin: boolean;
}

export default function ProjectUpdatesList({
  projectId,
  projectName,
  projectPrefix,
  initialUpdates,
  currentUserIsAdmin,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [updates, setUpdates] = useState<ProjectUpdate[]>(initialUpdates);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error || 'Falha ao gerar update');
      }
      // Recarregar lista completa para garantir consistência (inclui pm_completed_by_name).
      const listRes = await fetch(
        `/api/projects/${projectId}/updates`,
        { cache: 'no-store' },
      );
      if (listRes.ok) {
        const fresh = (await listRes.json()) as ProjectUpdate[];
        setUpdates(fresh);
      }
      toast('Status update gerado', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      toast(msg, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavePmNotes(updateId: string, notes: string) {
    const res = await fetch(
      `/api/projects/${projectId}/updates/${updateId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pm_notes: notes }),
      },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(err.error || 'Falha ao salvar notas');
    }
    setUpdates((prev) =>
      prev.map((u) =>
        u.id === updateId
          ? {
              ...u,
              pm_notes: notes,
              pm_completed_at: new Date().toISOString(),
            }
          : u,
      ),
    );
  }

  async function handleDelete(updateId: string) {
    const res = await fetch(
      `/api/projects/${projectId}/updates/${updateId}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(err.error || 'Falha ao excluir');
    }
    setUpdates((prev) => prev.filter((u) => u.id !== updateId));
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-[12px] text-tertiary-muted"
      >
        <button
          onClick={() => router.push('/projects')}
          className="inline-flex items-center gap-1 transition hover:text-primary"
        >
          <ArrowLeft size={12} />
          Projetos
        </button>
        <ChevronRight size={12} />
        <span className="text-secondary-muted">{projectName}</span>
        <ChevronRight size={12} />
        <span className="text-primary font-medium">Status Updates</span>
      </nav>

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="page-eyebrow">
            {projectPrefix ? `${projectPrefix} · ` : ''}
            {updates.length} update{updates.length !== 1 ? 's' : ''}
          </p>
          <h1 className="page-title">
            {projectName}{' '}
            <span className="em">— status updates semanais.</span>
          </h1>
          <p className="text-[13px] text-secondary-muted max-w-[520px]">
            Resumos automáticos gerados pela IA toda sexta-feira às 17h, com
            espaço para anotações do PM.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="btn-premium btn-primary"
        >
          {generating ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Gerando…
            </>
          ) : (
            <>
              <Sparkles size={13} strokeWidth={2.5} />
              Gerar update agora
            </>
          )}
        </button>
      </div>

      {/* Lista */}
      {updates.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhum status update ainda"
          description="O cron roda toda sexta-feira às 17h e gera o resumo da semana. Você também pode clicar em ‘Gerar update agora’ para criar um manualmente."
        />
      ) : (
        <div className="space-y-4">
          {updates.map((u) => (
            <ProjectUpdateCard
              key={u.id}
              update={u}
              projectPrefix={projectPrefix}
              isAdmin={currentUserIsAdmin}
              onSavePmNotes={handleSavePmNotes}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
