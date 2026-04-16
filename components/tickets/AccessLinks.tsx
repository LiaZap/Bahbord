'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Plus, X, Globe, Server, Shield, FileText, Code2, Link } from 'lucide-react';

interface AccessLink {
  id: string;
  label: string;
  url: string;
  type: string;
}

const typeConfig: Record<string, { icon: typeof Globe; color: string; label: string }> = {
  link: { icon: Link, color: '#94a3b8', label: 'Link' },
  staging: { icon: Server, color: '#f59e0b', label: 'Staging' },
  production: { icon: Globe, color: '#22c55e', label: 'Produção' },
  admin: { icon: Shield, color: '#a855f7', label: 'Admin' },
  docs: { icon: FileText, color: '#3b82f6', label: 'Docs' },
  api: { icon: Code2, color: '#f97316', label: 'API' },
};

interface AccessLinksProps {
  ticketId: string;
}

export default function AccessLinks({ ticketId }: AccessLinksProps) {
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('link');

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/access-links?ticket_id=${ticketId}`);
      if (res.ok) setLinks(await res.json());
    } catch (err) { console.error('Erro ao carregar acessos:', err); }
  }, [ticketId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  async function handleAdd() {
    if (!label.trim() || !url.trim()) return;
    await fetch('/api/access-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId, label: label.trim(), url: url.trim(), type }),
    });
    setLabel('');
    setUrl('');
    setType('link');
    setShowAdd(false);
    await fetchLinks();
  }

  async function handleRemove(id: string) {
    if (!confirm('Remover este acesso?')) return;
    await fetch(`/api/access-links?id=${id}`, { method: 'DELETE' });
    await fetchLinks();
  }

  return (
    <div>
      <h3 className="mb-2 text-[14px] font-semibold text-slate-200">
        Acessos
        {links.length > 0 && <span className="ml-1.5 text-[12px] font-normal text-slate-500">({links.length})</span>}
      </h3>

      {links.length > 0 && (
        <div className="space-y-1 mb-2">
          {links.map((link) => {
            const cfg = typeConfig[link.type] || typeConfig.link;
            const Icon = cfg.icon;
            return (
              <div key={link.id} className="group flex items-center gap-2 rounded-md px-1 py-1.5 transition hover:bg-white/[0.03]">
                <Icon size={14} style={{ color: cfg.color }} />
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                  style={{ backgroundColor: cfg.color + '20', color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-[13px] text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {link.label}
                  <ExternalLink size={10} className="ml-1 inline" />
                </a>
                <button onClick={() => handleRemove(link.id)} className="shrink-0 opacity-0 group-hover:opacity-100">
                  <X size={13} className="text-slate-600 hover:text-red-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <div className="mt-2 space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded border border-white/[0.06] bg-[var(--modal-bg)] px-2 py-1 text-[12px] text-slate-300 outline-none"
            >
              {Object.entries(typeConfig).map(([val, cfg]) => (
                <option key={val} value={val}>{cfg.label}</option>
              ))}
            </select>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nome do acesso"
              className="flex-1 rounded border border-white/[0.06] bg-[var(--modal-bg)] px-2 py-1 text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/30"
            />
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="https://..."
            className="w-full rounded border border-white/[0.06] bg-[var(--modal-bg)] px-2 py-1 text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/30"
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500">
              Adicionar
            </button>
            <button onClick={() => setShowAdd(false)} className="text-[11px] text-slate-500 hover:text-slate-300">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="mt-1 text-[13px] text-slate-500 hover:text-blue-400 transition">
          Adicionar acesso
        </button>
      )}
    </div>
  );
}
