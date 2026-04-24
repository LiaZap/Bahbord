'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Plus, Sun, Moon } from 'lucide-react';
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
  '/timesheet': 'Timesheet',
  '/settings': 'Configurações',
  '/docs': 'Documentação',
};

export default function Header({ onCreateTicket }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] || 'BahBoard';
  const searchParams = useSearchParams();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [boardName, setBoardName] = useState<string | null>(null);
  const [sprintGoal, setSprintGoal] = useState<string | null>(null);
  const boardId = searchParams.get('board_id');

  useEffect(() => {
    if (pathname === '/board' && boardId) {
      fetch('/api/boards')
        .then((r) => r.ok ? r.json() : [])
        .then(async (boards) => {
          const board = boards.find((b: any) => b.id === boardId);
          setBoardName(board?.name || null);

          // Try to find a sprint with the same name (auto-created sprint boards share the name)
          if (board?.name && board?.project_id) {
            try {
              const sRes = await fetch(`/api/sprints?project_id=${board.project_id}`);
              if (sRes.ok) {
                const sprints = await sRes.json();
                const match = sprints.find((s: any) => s.name === board.name);
                setSprintGoal(match?.goal || null);
              } else {
                setSprintGoal(null);
              }
            } catch {
              setSprintGoal(null);
            }
          } else {
            setSprintGoal(null);
          }
        })
        .catch(() => {});
    } else {
      setBoardName(null);
      setSprintGoal(null);
    }
  }, [pathname, boardId]);

  return (
    <header role="banner" className="glass flex h-14 shrink-0 items-center justify-between px-5 z-10">
      {/* Left side */}
      <div className="flex items-center gap-3 pl-10 md:pl-0">
        <h1 className="text-[15px] font-semibold text-primary">{pageTitle}</h1>
        {pathname === '/board' && boardName && (
          <span
            className="badge bg-accent/10 text-accent"
            title={sprintGoal ? `Objetivo: ${sprintGoal}` : undefined}
          >
            {boardName}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {onCreateTicket && (
          <button
            onClick={onCreateTicket}
            className="btn-premium btn-primary"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Criar</span>
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-lg p-2 text-secondary transition-all hover:bg-[var(--overlay-hover)] hover:text-primary"
          title={resolvedTheme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          aria-label={resolvedTheme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <NotificationCenter />
        <UserButton
          appearance={{
            elements: { avatarBox: 'h-7 w-7' },
          }}
        />
      </div>
    </header>
  );
}
