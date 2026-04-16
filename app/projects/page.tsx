'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, Archive, ArrowLeft } from 'lucide-react';
import { useProject } from '@/lib/project-context';
import { useToast } from '@/components/ui/Toast';

interface Project {
  id: string;
  name: string;
  prefix: string;
  color: string;
  description: string | null;
  is_archived: boolean;
  board_count: number;
  ticket_count: number;
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
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"><ArrowLeft size={18} /></button>
          <div>
          <h1 className="text-xl font-bold text-white">Projetos</h1>
          <p className="mt-1 text-sm text-slate-500">{projects.length} projeto{projects.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={15} />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => openProject(p)}
            className="group cursor-pointer rounded-lg border border-border/40 bg-surface2 p-5 transition hover:border-white/[0.12] hover:bg-[var(--card-hover)]"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-[14px] font-bold text-white" style={{ backgroundColor: p.color }}>
                {p.prefix.substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-white truncate">{p.name}</h3>
                <span className="text-[11px] font-mono text-slate-500">{p.prefix}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleArchive(p.id); }}
                className="shrink-0 rounded p-1 text-slate-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                title="Arquivar"
              >
                <Archive size={14} />
              </button>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><FolderKanban size={12} /> {p.board_count || 0} boards</span>
              <span>{p.ticket_count || 0} tickets</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
