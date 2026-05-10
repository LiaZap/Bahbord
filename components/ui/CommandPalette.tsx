'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Command } from 'cmdk';
import {
  Search, Columns3, List, Inbox, Zap, CalendarDays, Clock,
  FolderKanban, Users, Settings, FileText, BookOpen, Home,
  Sun, Moon, Star, Calendar,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface SearchResult {
  id: string;
  title: string;
  ticket_key?: string;
  _type: 'ticket' | 'doc';
}

export default function CommandPalette() {
  const router = useRouter();
  const tCmd = useTranslations('commandPalette');
  const tNav = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { toggleTheme, resolvedTheme } = useTheme();

  // Detecta role do usuário para filtrar ações disponíveis
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.member?.role;
        setIsAdmin(role === 'owner' || role === 'admin');
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSearchResults([]);
    }
  }, [open]);

  // Search tickets and docs when query >= 2 chars
  useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const [t, d] = await Promise.all([
          fetch(`/api/tickets/search?q=${encodeURIComponent(query)}`).then((r) => (r.ok ? r.json() : [])),
          fetch(`/api/docs/pages?search=${encodeURIComponent(query)}`).then((r) => (r.ok ? r.json() : [])),
        ]);
        const tickets: SearchResult[] = (t || []).map((x: Record<string, unknown>) => ({ ...x, _type: 'ticket' as const } as SearchResult));
        const docs: SearchResult[] = (d || []).map((x: Record<string, unknown>) => ({ ...x, _type: 'doc' as const } as SearchResult));
        setSearchResults([...tickets, ...docs]);
      } catch {
        // noop
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    setQuery('');
    fn();
  }, []);

  if (!open) return null;

  const itemClass =
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 aria-selected:bg-accent/10 aria-selected:text-accent cursor-pointer';
  const groupHeadingClass =
    'text-[10px] font-semibold uppercase tracking-wider text-slate-600 px-2 pt-2 pb-1';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="glass w-full max-w-[640px] rounded-2xl shadow-2xl shadow-black/40 animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="flex flex-col max-h-[60vh]">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <Search size={18} className="shrink-0 text-slate-500" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={tCmd('placeholder')}
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
            <kbd className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd>
          </div>

          <Command.List className="flex-1 overflow-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              {tCmd('noResults')}
            </Command.Empty>

            {/* Quick actions */}
            {query.length < 2 && authChecked && (
              <>
                {/* Pessoal — todos os usuários */}
                <Command.Group heading={tCmd('personal')} className={groupHeadingClass}>
                  <Command.Item onSelect={() => run(() => router.push('/inbox'))} className={itemClass}>
                    <Inbox size={14} /> {tNav('inbox')}
                  </Command.Item>
                  <Command.Item onSelect={() => run(() => router.push('/my-tasks'))} className={itemClass}>
                    <Star size={14} /> {tNav('myTasks')}
                  </Command.Item>
                  <Command.Item onSelect={() => run(() => router.push('/this-week'))} className={itemClass}>
                    <Calendar size={14} /> {tNav('thisWeek')}
                  </Command.Item>
                </Command.Group>

                {/* Workspace — só admin */}
                {isAdmin && (
                  <Command.Group heading={tCmd('workspace')} className={groupHeadingClass}>
                    <Command.Item onSelect={() => run(() => router.push('/'))} className={itemClass}>
                      <Home size={14} /> {tNav('dashboard')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/boards'))} className={itemClass}>
                      <Columns3 size={14} /> {tNav('boards')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/sprints'))} className={itemClass}>
                      <Zap size={14} /> {tNav('sprints')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/timeline'))} className={itemClass}>
                      <CalendarDays size={14} /> {tNav('timeline')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/timesheet'))} className={itemClass}>
                      <Clock size={14} /> {tNav('timesheet')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/docs'))} className={itemClass}>
                      <BookOpen size={14} /> {tNav('docs')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/projects'))} className={itemClass}>
                      <FolderKanban size={14} /> {tNav('projects')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/clients'))} className={itemClass}>
                      <Users size={14} /> {tNav('clients')}
                    </Command.Item>
                    <Command.Item onSelect={() => run(() => router.push('/settings'))} className={itemClass}>
                      <Settings size={14} /> {tNav('settings')}
                    </Command.Item>
                  </Command.Group>
                )}

                <Command.Group heading={tCmd('theme')} className={groupHeadingClass}>
                  <Command.Item onSelect={() => run(() => toggleTheme())} className={itemClass}>
                    {resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    {tCmd('toggleTheme', { mode: resolvedTheme === 'dark' ? tCmd('themeLight') : tCmd('themeDark') })}
                  </Command.Item>
                </Command.Group>
              </>
            )}

            {/* Search results */}
            {query.length >= 2 && searchResults.length > 0 && (
              <Command.Group heading={tCmd('results')} className={groupHeadingClass}>
                {searchResults.map((r) => (
                  <Command.Item
                    key={`${r._type}-${r.id}`}
                    onSelect={() =>
                      run(() =>
                        router.push(r._type === 'doc' ? `/docs?page=${r.id}` : `/ticket/${r.id}`)
                      )
                    }
                    className={itemClass}
                  >
                    <FileText size={14} />
                    <div className="flex-1 min-w-0">
                      {r.ticket_key && (
                        <span className="font-mono text-[11px] text-slate-500 mr-2">{r.ticket_key}</span>
                      )}
                      <span className="truncate">{r.title}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2 text-[10px] text-slate-600">
            <span>
              <kbd className="rounded bg-surface px-1 py-0.5">↑↓</kbd> {tCmd('navigate')}
            </span>
            <span>
              <kbd className="rounded bg-surface px-1 py-0.5">Enter</kbd> {tCmd('selectAction')}
            </span>
            <span>
              <kbd className="rounded bg-surface px-1 py-0.5">Esc</kbd> {tCmd('close')}
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
