'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const { resolvedTheme, toggleTheme } = useTheme();
  const [sprintName, setSprintName] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === '/board') {
      fetch('/api/sprints')
        .then((r) => r.ok ? r.json() : [])
        .then((sprints) => {
          const active = sprints.find((s: any) => s.is_active);
          setSprintName(active?.name || null);
        })
        .catch(() => {});
    }
  }, [pathname]);

  return (
    <header className="glass flex h-14 shrink-0 items-center justify-between px-5 z-10">
      {/* Left side */}
      <div className="flex items-center gap-3 pl-10 md:pl-0">
        <h1 className="text-[15px] font-semibold text-primary">{pageTitle}</h1>
        {pathname === '/board' && sprintName && (
          <span className="badge bg-accent/10 text-accent">
            {sprintName}
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
