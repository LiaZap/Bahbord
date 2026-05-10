'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, Archive, ArrowLeft, FileBarChart, FileText, Target } from 'lucide-react';
import { useProject } from '@/lib/project-context';
import { useToast } from '@/components/ui/Toast';
import EmptyState from '@/components/ui/EmptyState';

interface Project {
  id: string;
  name: string;
  prefix: string;
  color: string;
  description: string | null;
  is_archived: boolean;
  board_count: number;
  ticket_count: number;
  initiative_count?: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { setProject } = useProject();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/options?type=templates').then((r) => r.json()),
    ]).then(([p, t]) => {
      setProjects(p);
      setTemplates(t);
    }).catch(() => toast('Erro ao carregar projetos', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!name.trim() || !prefix.trim()) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), prefix: prefix.trim().toUpperCase(), color, template_id: templateId || undefined }),
    });
    if (res.ok) {
      const project = await res.json();
      toast('Projeto criado', 'success');
      setShowCreate(false);
      setName('');
      setPrefix('');
      setProjects((prev) => [...prev, { ...project, board_count: 0, ticket_count: 0 }]);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Arquivar este projeto?')) return;
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_archived: true }),
    });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    toast('Projeto arquivado', 'success');
  }

  function openProject(project: Project) {
    setProject(project.id);
    router.push('/board');
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="page-eyebrow">Workspace · {projects.length} projeto{projects.length !== 1 ? 's' : ''} ativo{projects.length !== 1 ? 's' : ''}</p>
          <h1 className="page-title">
            Projetos <span className="em">— cada coisa no seu lugar.</span>
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-premium btn-primary"
        >
          <Plus size={13} strokeWidth={2.5} />
          Novo projeto
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-accent/30 bg-surface2 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Criar projeto</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Nome</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Meu Projeto" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Prefixo (ex: BAH, LFT)</label>
              <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} maxLength={5} placeholder="PRJ" className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Cor</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded border-0 bg-transparent" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none">
                <option value="">Sem template</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">Criar</button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-slate-500 hover:text-slate-300">Cancelar</button>
          </div>
        </div>
      )}

      {projects.length === 0 && !showCreate ? (
        <EmptyState
          illustration="no-projects"
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto pra organizar boards, tickets e clientes em um só lugar."
          actions={[
            { label: 'Criar projeto', onClick: () => setShowCreate(true), variant: 'primary' },
          ]}
        />
      ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => openProject(p)}
            className="card-premium group cursor-pointer p-4 transition"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md text-[12px] font-bold text-white shrink-0" style={{ backgroundColor: p.color }}>
                {p.prefix.substring(0, 3).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-primary truncate">{p.name}</h3>
                <p className="text-[11px] text-secondary mt-0.5">
                  {p.description || 'Sem descrição'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                {!p.is_archived && (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/projects/${p.id}/updates` as never); }}
                    className="rounded p-1 text-[var(--text-tertiary)] transition hover:text-[var(--accent)]"
                    title="Status updates"
                    aria-label="Status updates"
                  >
                    <FileBarChart size={13} />
                  </button>
                )}
                {!p.is_archived && (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/projects/${p.id}/spec` as never); }}
                    className="rounded p-1 text-[var(--text-tertiary)] transition hover:text-[var(--accent)]"
                    title="Spec do projeto"
                    aria-label="Spec do projeto"
                  >
                    <FileText size={13} />
                  </button>
                )}
                {!p.is_archived && (p.initiative_count ?? 0) > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/roadmap?project_id=${p.id}` as never); }}
                    className="rounded p-1 text-[var(--text-tertiary)] transition hover:text-[var(--accent)]"
                    title={`${p.initiative_count} iniciativa${p.initiative_count === 1 ? '' : 's'}`}
                    aria-label="Iniciativas"
                  >
                    <Target size={13} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleArchive(p.id); }}
                  className="rounded p-1 text-[var(--text-tertiary)] transition hover:text-[var(--danger)]"
                  title="Arquivar"
                  aria-label="Arquivar"
                >
                  <Archive size={13} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2 text-[11px]">
              <span className="font-mono tabular-nums text-[var(--text-tertiary)]">{p.prefix}</span>
              <span className="font-medium text-secondary tabular-nums">{p.ticket_count || 0} tickets</span>
            </div>

            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--overlay-subtle)]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, ((p.ticket_count || 0) / 50) * 100)}%`, backgroundColor: p.color }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-tertiary)] flex items-center gap-1">
                  <FolderKanban size={11} />
                  {p.board_count || 0} board{p.board_count !== 1 ? 's' : ''}
                </span>
                {(p.initiative_count ?? 0) > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/roadmap?project_id=${p.id}` as never); }}
                    className="text-[var(--text-tertiary)] flex items-center gap-1 transition hover:text-[var(--accent)]"
                    title="Ver iniciativas no roadmap"
                  >
                    <Target size={11} />
                    {p.initiative_count} iniciativa{p.initiative_count === 1 ? '' : 's'}
                  </button>
                )}
              </div>
              <span className="text-[var(--accent)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Abrir →</span>
            </div>
          </div>
        ))}

        {/* Empty state card */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex min-h-[160px] flex-col items-center justify-center rounded-md border border-dashed border-[var(--card-border)] bg-transparent text-secondary transition hover:border-[var(--accent)] hover:text-primary"
        >
          <Plus size={20} strokeWidth={1.5} />
          <span className="mt-2 text-[13px] font-medium">Criar projeto</span>
          <span className="mt-1 text-[11px] text-[var(--text-tertiary)]">Comece com um template ou do zero</span>
        </button>
      </div>
      )}
    </div>
  );
}
