'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Plus, Sun, Moon, Sparkles, Filter as FilterIcon } from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import NotificationCenter from '@/components/ui/NotificationCenter';
import { useTheme } from '@/lib/theme-context';

interface HeaderProps {
  onCreateTicket?: () => void;
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/board': 'Quadro',
  '/list': 'Lista',
  '/backlog': 'Backlog',
  '/sprints': 'Sprints',
  '/timeline': 'Cronograma',
  '/timesheet': 'Time',
  '/settings': 'Configurações',
  '/docs': 'Documentação',
  '/reports': 'Relatórios',
  '/projects': 'Projetos',
  '/clients': 'Clientes',
  '/teams': 'Equipes',
  '/filters': 'Filtros',
  '/boards': 'Boards',
};

export default function Header({ onCreateTicket }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] || 'BahBoard';
  const searchParams = useSearchParams();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [boardName, setBoardName] = useState<string | null>(null);
  const [memberAvatars, setMemberAvatars] = useState<Array<{ id: string; display_name: string; avatar_url?: string }>>([]);
  const boardId = searchParams.get('board_id');

  useEffect(() => {
    if (pathname === '/board' && boardId) {
      fetch('/api/boards')
        .then((r) => r.ok ? r.json() : [])
        .then((boards) => {
          const board = boards.find((b: any) => b.id === boardId);
          setBoardName(board?.name || null);
        })
        .catch(() => {});
    } else {
      setBoardName(null);
    }
  }, [pathname, boardId]);

  useEffect(() => {
    fetch('/api/options?type=members')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMemberAvatars(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  function colorFromName(name: string): string {
    const palette = ['#3b6cf5', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  const visibleAvatars = memberAvatars.slice(0, 3);
  const overflow = Math.max(0, memberAvatars.length - visibleAvatars.length);

  return (
    <header role="banner" className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--bg-primary)] px-4 z-10">
      {/* Breadcrumb — collapse no mobile */}
      <div className="flex items-center gap-2 pl-12 md:pl-0 text-[12.5px] min-w-0 flex-1">
        <span className="text-secondary hidden sm:inline">Bah!Company</span>
        <span className="text-[var(--text-tertiary)] hidden sm:inline">/</span>
        <span className="text-primary font-medium truncate">{pageTitle}</span>
        {pathname === '/board' && boardName && (
          <>
            <span className="text-[var(--text-tertiary)] hidden sm:inline">/</span>
            <span className="text-secondary truncate max-w-[140px] md:max-w-[200px] hidden sm:inline">{boardName}</span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {/* Pergunta pra IA */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="hidden md:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"
          title="Pergunta pra IA (⌘K)"
        >
          <Sparkles size={13} strokeWidth={1.75} />
          <span>Pergunta pra IA</span>
        </button>

        {/* Filtros */}
        <button
          className="hidden md:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"
        >
          <FilterIcon size={13} strokeWidth={1.75} />
          <span>Filtros</span>
        </button>

        {/* Member avatars */}
        {visibleAvatars.length > 0 && (
          <div className="hidden md:flex items-center -space-x-1.5 mr-1 ml-1">
            {visibleAvatars.map((m) => (
              m.avatar_url ? (
                <img
                  key={m.id}
                  src={m.avatar_url}
                  alt={m.display_name}
                  title={m.display_name}
                  className="h-6 w-6 rounded-full ring-2 ring-[var(--bg-primary)] object-cover"
                />
              ) : (
                <div
                  key={m.id}
                  title={m.display_name}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-[var(--bg-primary)]"
                  style={{ backgroundColor: colorFromName(m.display_name) }}
                >
                  {getInitials(m.display_name)}
                </div>
              )
            ))}
            {overflow > 0 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--card-hover)] text-[9px] font-bold text-secondary ring-2 ring-[var(--bg-primary)]">
                +{overflow}
              </div>
            )}
          </div>
        )}

        {/* Novo ticket - primary */}
        {onCreateTicket && (
          <button
            onClick={onCreateTicket}
            className="btn-premium btn-primary"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span className="hidden sm:inline">Novo ticket</span>
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-md p-1.5 text-secondary transition hover:bg-[var(--overlay-hover)] hover:text-primary"
          title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          aria-label={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {resolvedTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <NotificationCenter />
        <UserButton
          appearance={{ elements: { avatarBox: 'h-6 w-6' } }}
        />
      </div>
    </header>
  );
}
