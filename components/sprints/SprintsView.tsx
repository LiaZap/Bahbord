'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Play, CheckCircle, Calendar, Target, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_completed: boolean;
  created_at: string;
  completed_at: string | null;
  ticket_count: number;
  done_count: number;
  project_id: string | null;
  project_name: string | null;
}

interface Project {
  id: string;
  name: string;
}

export default function SprintsView() {
  const searchParams = useSearchParams();
  const boardIdParam = searchParams.get('board_id');
  const projectIdParam = searchParams.get('project_id');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectIdParam);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newProjectId, setNewProjectId] = useState(projectIdParam || '');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchSprints = useCallback(async () => {
    try {
      // If board_id in URL, resolve to project_id
      let projectId = projectIdParam;
      if (boardIdParam && !projectId) {
        const bRes = await fetch('/api/boards');
        if (bRes.ok) {
          const boards = await bRes.json();
          const board = boards.find((b: any) => b.id === boardIdParam);
          projectId = board?.project_id || null;
          setCurrentProjectId(projectId);
          if (projectId) setNewProjectId(projectId);
        }
      }

      const sprintUrl = projectId ? `/api/sprints?project_id=${projectId}` : '/api/sprints';
      const [sprintRes, projRes] = await Promise.all([
        fetch(sprintUrl),
        fetch('/api/options?type=projects'),
      ]);
      if (sprintRes.ok) setSprints(await sprintRes.json());
      if (projRes.ok) setProjects(await projRes.json());
    } catch (err) { console.error('Erro ao carregar sprints:', err); }
    finally { setLoading(false); }
  }, [boardIdParam, projectIdParam]);

  useEffect(() => { fetchSprints(); }, [fetchSprints]);

  async function handleCreate() {
    if (!newName.trim() || !newProjectId || !newStart || !newEnd) return;
    const res = await fetch('/api/sprints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), goal: newGoal || null, start_date: newStart, end_date: newEnd, project_id: newProjectId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Erro ao criar sprint');
      return;
    }
    setNewName('');
    setNewGoal('');
    setNewProjectId('');
    setNewStart('');
    setNewEnd('');
    setShowCreate(false);
    await fetchSprints();
  }

  async function handleAction(id: string, action: string) {
    if (action === 'complete' && !confirm('Concluir este sprint? Um próximo sprint será criado automaticamente.')) return;
    await fetch('/api/sprints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });

    // Auto-create next sprint when completing
    if (action === 'complete') {
      const completed = sprints.find((s) => s.id === id);
      if (completed && completed.project_id) {
        // Calculate next sprint number from name
        const match = completed.name.match(/(\d+)/);
        const nextNum = match ? parseInt(match[1]) + 1 : 1;
        const nextName = match ? completed.name.replace(/\d+/, String(nextNum)) : `Sprint ${nextNum}`;

        // Calculate next dates (same duration)
        let nextStart: string | undefined;
        let nextEnd: string | undefined;
        if (completed.start_date && completed.end_date) {
          const start = new Date(completed.start_date);
          const end = new Date(completed.end_date);
          const duration = end.getTime() - start.getTime();
          const newStart = new Date(end.getTime() + 86400000); // +1 day after end
          const newEnd = new Date(newStart.getTime() + duration);
          nextStart = newStart.toISOString().split('T')[0];
          nextEnd = newEnd.toISOString().split('T')[0];
        }

        await fetch('/api/sprints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nextName,
            project_id: completed.project_id,
            start_date: nextStart,
            end_date: nextEnd,
          }),
        });
      }
    }

    await fetchSprints();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este sprint? Esta ação não pode ser desfeita.')) return;
    const res = await fetch(`/api/sprints?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Erro ao remover sprint');
      return;
    }
    await fetchSprints();
  }

  function formatDate(d: string | null) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function daysRemaining(endDate: string | null) {
    if (!endDate) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Finalizado';
    if (diff === 0) return 'Último dia';
    return `${diff} dia${diff > 1 ? 's' : ''} restante${diff > 1 ? 's' : ''}`;
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  const activeSprints = sprints.filter((s) => s.is_active);
  const futureSprints = sprints.filter((s) => !s.is_active && !s.is_completed);
  const completedSprints = sprints.filter((s) => s.is_completed);

  function renderSprint(sprint: Sprint) {
    const progress = sprint.ticket_count > 0 ? (sprint.done_count / sprint.ticket_count) * 100 : 0;
    const isExpanded = expanded === sprint.id;
    const remaining = daysRemaining(sprint.end_date);

    return (
      <div key={sprint.id} className="rounded-lg border border-border/40 bg-surface2 overflow-hidden">
        <div
          className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-surface"
          onClick={() => setExpanded(isExpanded ? null : sprint.id)}
        >
          {isExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}

          {/* Status badge */}
          {sprint.is_active && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">Ativo</span>
          )}
          {sprint.is_completed && (
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-semibold text-success">Concluído</span>
          )}
          {!sprint.is_active && !sprint.is_completed && (
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Futuro</span>
          )}

          <span className="text-sm font-medium text-white">{sprint.name}</span>
          {sprint.project_name && (
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{sprint.project_name}</span>
          )}

          <span className="text-[11px] text-slate-500">
            {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
          </span>

          {remaining && sprint.is_active && (
            <span className={cn('text-[11px] font-medium', remaining === 'Finalizado' ? 'text-danger' : 'text-slate-400')}>
              {remaining}
            </span>
          )}

          <span className="ml-auto text-[11px] text-slate-400">
            {sprint.done_count}/{sprint.ticket_count} tickets
          </span>

          {/* Mini progress bar */}
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border/30 px-4 py-3 space-y-3">
            {sprint.goal && (
              <div className="flex items-start gap-2">
                <Target size={13} className="mt-0.5 text-slate-500" />
                <p className="text-xs text-slate-400">{sprint.goal}</p>
              </div>
            )}

            {/* Progress detail */}
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-500">Progresso</span>
                <span className="text-slate-300">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!sprint.is_active && !sprint.is_completed && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(sprint.id, 'activate'); }}
                  className="flex items-center gap-1.5 rounded bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/30"
                >
                  <Play size={12} fill="currentColor" />
                  Ativar sprint
                </button>
              )}
              {sprint.is_active && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAction(sprint.id, 'complete'); }}
                  className="flex items-center gap-1.5 rounded bg-success/20 px-3 py-1.5 text-xs font-medium text-success transition hover:bg-success/30"
                >
                  <CheckCircle size={12} />
                  Concluir sprint
                </button>
              )}
              {!sprint.is_active && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(sprint.id); }}
                  className="flex items-center gap-1.5 rounded bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  <Trash2 size={12} />
                  Remover
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Sprints</h1>
          <p className="mt-1 text-sm text-slate-500">Gerenciar ciclos de trabalho</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={15} />
          Novo sprint
        </button>
      </div>

      {/* Create sprint form */}
      {showCreate && (
        <div className="rounded-lg border border-accent/30 bg-surface2 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Criar sprint</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Projeto <span className="text-red-400">*</span></label>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full rounded border border-border/40 bg-surface px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
              >
                <option value="">Selecione um projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Nome <span className="text-red-400">*</span></label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Sprint 24"
                className="w-full rounded border border-border/40 bg-surface px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Objetivo</label>
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Objetivo do sprint"
                className="w-full rounded border border-border/40 bg-surface px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Início <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-full rounded border border-border/40 bg-surface px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Fim <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-full rounded border border-border/40 bg-surface px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500">
              Criar
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-slate-500 hover:text-slate-300">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Active sprints */}
      {activeSprints.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Sprint ativo</h2>
          <div className="space-y-1">{activeSprints.map(renderSprint)}</div>
        </div>
      )}

      {/* Future sprints */}
      {futureSprints.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Próximos sprints</h2>
          <div className="space-y-1">{futureSprints.map(renderSprint)}</div>
        </div>
      )}

      {/* Completed sprints - collapsible history */}
      {completedSprints.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition"
          >
            {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Histórico ({completedSprints.length})
          </button>
          {showHistory && <div className="space-y-1">{completedSprints.map(renderSprint)}</div>}
        </div>
      )}

      {sprints.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500">
          Nenhum sprint criado. Clique em "Novo sprint" para começar.
        </div>
      )}
    </div>
  );
}
