'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { Plus, Filter, Users, Sun, Moon } from 'lucide-react';
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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-surface px-5">
      {/* Left side */}
      <div className="flex items-center gap-3 pl-10 md:pl-0">
        <h1 className="text-[15px] font-semibold text-white">{pageTitle}</h1>
        {pathname === '/board' && (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-400">
            Sprint 23
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {onCreateTicket && (
          <button
            onClick={onCreateTicket}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.98]"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Criar</span>
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-md p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
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
