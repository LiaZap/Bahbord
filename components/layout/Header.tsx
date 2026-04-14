'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { Plus, Filter, Users } from 'lucide-react';
import NotificationCenter from '@/components/ui/NotificationCenter';

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
};

export default function Header({ onCreateTicket }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = pageTitles[pathname] || 'BahBoard';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#1a1c1e] px-5">
      {/* Left side */}
      <div className="flex items-center gap-3 pl-10 lg:pl-0">
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
        <NotificationCenter />
      </div>
    </header>
  );
}
