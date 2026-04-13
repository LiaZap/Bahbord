'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Link2, Search } from 'lucide-react';

interface TicketLink {
  id: string;
  link_type: string;
  direction: string;
  ticket_key: string;
  title: string;
  status_name: string;
  status_color: string;
}

interface SearchResult {
  id: string;
  title: string;
  ticket_key?: string;
}

const linkTypeLabels: Record<string, string> = {
  blocks: 'bloqueia',
  is_blocked_by: 'é bloqueado por',
  relates_to: 'relaciona-se com',
  duplicates: 'duplica',
  is_duplicated_by: 'é duplicado por',
};

interface LinkedTicketsProps {
  ticketId: string;
}

export default function LinkedTickets({ ticketId }: LinkedTicketsProps) {
  const [links, setLinks] = useState<TicketLink[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedType, setSelectedType] = useState('relates_to');

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/ticket-links?ticket_id=${ticketId}`);
      if (res.ok) setLinks(await res.json());
    } catch { /* silencioso */ }
  }, [ticketId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/tickets`);
      if (res.ok) {
        const all = await res.json();
        const filtered = all.filter((t: SearchResult) =>
          t.id !== ticketId &&
          (t.title?.toLowerCase().includes(q.toLowerCase()) ||
           t.ticket_key?.toLowerCase().includes(q.toLowerCase()))
        );
        setSearchResults(filtered.slice(0, 8));
      }
    } catch { /* silencioso */ }
  }

  async function handleAdd(targetId: string) {
    await fetch('/api/ticket-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_ticket_id: ticketId,
        target_ticket_id: targetId,
        link_type: selectedType,
      }),
    });
    setShowAdd(false);
    setSearchQuery('');
    setSearchResults([]);
    await fetchLinks();
  }

  async function handleRemove(linkId: string) {
    await fetch(`/api/ticket-links?id=${linkId}`, { method: 'DELETE' });
    await fetchLinks();
  }

  // Agrupar por tipo
  const grouped = links.reduce<Record<string, TicketLink[]>>((acc, link) => {
    const label = linkTypeLabels[link.link_type] || link.link_type;
    if (!acc[label]) acc[label] = [];
    acc[label].push(link);
    return acc;
  }, {});

  return (
    <section className="rounded-lg border border-border/40 bg-surface2 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Link2 size={13} />
          Tickets vinculados
          {links.length > 0 && <span className="text-slate-600">({links.length})</span>}
        </h2>
      </div>

      {/* Grouped links */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="mb-2">
          <p className="mb-1 text-[11px] font-medium text-slate-500">{type}</p>
          {items.map((link) => (
            <div key={link.id} className="group flex items-center gap-2 rounded px-2 py-1 transition hover:bg-surface">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: link.status_color + '20', color: link.status_color }}
              >
                {link.status_name}
              </span>
              <span className="font-mono text-[11px] text-slate-500">{link.ticket_key}</span>
              <span className="flex-1 truncate text-xs text-slate-300">{link.title}</span>
              <button
                onClick={() => handleRemove(link.id)}
                className="shrink-0 opacity-0 transition hover:text-danger group-hover:opacity-100"
              >
                <X size={13} className="text-slate-600 hover:text-danger" />
              </button>
            </div>
          ))}
        </div>
      ))}

      {/* Add link */}
      {showAdd ? (
        <div className="mt-2 space-y-2 rounded border border-border/40 bg-surface p-3">
          <div className="flex gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded border border-border/40 bg-surface2 px-2 py-1 text-xs text-slate-300 outline-none"
            >
              {Object.entries(linkTypeLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar ticket..."
                className="w-full rounded border border-border/40 bg-surface2 py-1 pl-7 pr-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/60"
              />
            </div>
            <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-40 space-y-0.5 overflow-auto">
              {searchResults.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAdd(t.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition hover:bg-surface2"
                >
                  <span className="font-mono text-slate-500">{t.ticket_key}</span>
                  <span className="truncate text-slate-300">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-1 flex items-center gap-1 text-xs text-slate-500 transition hover:text-accent"
        >
          <Plus size={14} />
          Adicionar ticket vinculado
        </button>
      )}
    </section>
  );
}
