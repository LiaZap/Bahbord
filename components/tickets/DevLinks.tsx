'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitBranch, GitPullRequest, GitCommit, Plus, X } from 'lucide-react';

interface DevLink {
  id: string;
  ticket_id: string;
  type: 'branch' | 'pull_request' | 'commit';
  title: string;
  url: string | null;
  status: string | null;
  provider: string;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  branch: 'Branches',
  pull_request: 'Pull Requests',
  commit: 'Commits',
};

const typeIcons: Record<string, typeof GitBranch> = {
  branch: GitBranch,
  pull_request: GitPullRequest,
  commit: GitCommit,
};

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  merged: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  closed: { bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

interface DevLinksProps {
  ticketId: string;
}

export default function DevLinks({ ticketId }: DevLinksProps) {
  const [links, setLinks] = useState<DevLink[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [formType, setFormType] = useState<string>('branch');
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formStatus, setFormStatus] = useState('open');

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/dev-links?ticket_id=${ticketId}`);
      if (res.ok) setLinks(await res.json());
    } catch (err) { console.error('Erro ao carregar dev links:', err); }
  }, [ticketId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  async function handleAdd() {
    if (!formTitle.trim()) return;
    try {
      await fetch('/api/dev-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          type: formType,
          title: formTitle.trim(),
          url: formUrl.trim() || null,
          status: formStatus,
        }),
      });
      setShowAdd(false);
      setFormTitle('');
      setFormUrl('');
      setFormStatus('open');
      await fetchLinks();
    } catch (err) { console.error('Erro ao criar dev link:', err); }
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`/api/dev-links?id=${id}`, { method: 'DELETE' });
      await fetchLinks();
    } catch (err) { console.error('Erro ao remover dev link:', err); }
  }

  const grouped = links.reduce<Record<string, DevLink[]>>((acc, link) => {
    if (!acc[link.type]) acc[link.type] = [];
    acc[link.type].push(link);
    return acc;
  }, {});

  return (
    <div>
      <h3 className="mb-2 text-[14px] font-semibold text-slate-200">
        Desenvolvimento
        {links.length > 0 && <span className="ml-1.5 text-[12px] font-normal text-slate-500">({links.length})</span>}
      </h3>

      {Object.entries(grouped).map(([type, items]) => {
        const Icon = typeIcons[type] || GitBranch;
        return (
          <div key={type} className="mb-2">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{typeLabels[type] || type}</p>
            {items.map((link) => {
              const colors = statusColors[link.status || ''] || statusColors.open;
              return (
                <div key={link.id} className="group flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-white/[0.03]">
                  <Icon size={14} className="shrink-0 text-slate-500" />
                  {link.url ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-[13px] text-slate-300 hover:text-blue-400 transition"
                    >
                      {link.title}
                    </a>
                  ) : (
                    <span className="flex-1 truncate text-[13px] text-slate-300">{link.title}</span>
                  )}
                  {link.status && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
                      {link.status}
                    </span>
                  )}
                  <button onClick={() => handleRemove(link.id)} className="shrink-0 opacity-0 group-hover:opacity-100">
                    <X size={13} className="text-slate-600 hover:text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {showAdd ? (
        <div className="mt-2 space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex gap-2">
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="rounded border border-white/[0.06] bg-[#1e2126] px-2 py-1 text-[12px] text-slate-300 outline-none"
            >
              <option value="branch">Branch</option>
              <option value="pull_request">Pull Request</option>
              <option value="commit">Commit</option>
            </select>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              className="rounded border border-white/[0.06] bg-[#1e2126] px-2 py-1 text-[12px] text-slate-300 outline-none"
            >
              <option value="open">open</option>
              <option value="merged">merged</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <input
            autoFocus
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Nome da branch, PR ou commit..."
            className="w-full rounded border border-white/[0.06] bg-[#1e2126] px-2 py-1 text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/30"
          />
          <input
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="URL (opcional)"
            className="w-full rounded border border-white/[0.06] bg-[#1e2126] px-2 py-1 text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/30"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="rounded bg-blue-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-blue-500"
            >
              Adicionar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded px-3 py-1 text-[12px] text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="mt-1 flex items-center gap-1 text-[13px] text-slate-500 hover:text-blue-400 transition">
          <Plus size={13} />
          Adicionar link de desenvolvimento
        </button>
      )}
    </div>
  );
}
