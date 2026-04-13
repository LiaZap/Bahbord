'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SearchResult {
  id: string;
  title: string;
  ticket_key?: string;
  status?: string;
  status_color?: string;
  service?: string;
  assignee?: string;
}

export default function SearchModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const all: SearchResult[] = await res.json();
        const lower = q.toLowerCase();
        const filtered = all.filter((t) =>
          t.title?.toLowerCase().includes(lower) ||
          t.ticket_key?.toLowerCase().includes(lower)
        );
        setResults(filtered.slice(0, 10));
        setSelectedIndex(0);
      }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  function navigate(id: string) {
    setIsOpen(false);
    router.push(`/ticket/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigate(results[selectedIndex].id);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border/60 bg-surface2 shadow-2xl shadow-black/40 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar tickets..."
            className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
          />
          <kbd className="hidden rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">ESC</kbd>
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300 sm:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-auto py-1">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              Nenhum resultado para &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => navigate(r.id)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition',
                i === selectedIndex ? 'bg-accent/10' : 'hover:bg-surface'
              )}
            >
              <FileText size={14} className="shrink-0 text-slate-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {r.ticket_key && (
                    <span className="font-mono text-[11px] text-slate-500">{r.ticket_key}</span>
                  )}
                  <span className="truncate text-sm text-slate-200">{r.title}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                  {r.status && <span>{r.status}</span>}
                  {r.service && <span>{r.service}</span>}
                  {r.assignee && <span>{r.assignee}</span>}
                </div>
              </div>
              {i === selectedIndex && <ArrowRight size={12} className="shrink-0 text-accent" />}
            </button>
          ))}

          {!loading && query.length < 2 && (
            <div className="py-8 text-center text-xs text-slate-500">
              Digite para buscar tickets por título ou key
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border/40 px-4 py-2 text-[10px] text-slate-600">
          <span><kbd className="rounded bg-surface px-1 py-0.5">↑↓</kbd> navegar</span>
          <span><kbd className="rounded bg-surface px-1 py-0.5">Enter</kbd> abrir</span>
          <span><kbd className="rounded bg-surface px-1 py-0.5">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
