'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { Plus } from 'lucide-react';
import NotificationCenter from '@/components/ui/NotificationCenter';

const tabs = [
  { href: '/', label: 'Resumo' },
  { href: '/board', label: 'Quadros' },
  { href: '/backlog', label: 'Backlog' },
  { href: '/list', label: 'Lista' }
];

interface HeaderProps {
  onCreateTicket?: () => void;
}

export default function Header({ onCreateTicket }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-border/50 bg-sidebar">
      {/* Top row */}
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2 pl-10 lg:pl-0">
          <div className="hidden h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-violet-600 text-[9px] font-bold text-white sm:flex">
            B
          </div>
          <span className="text-sm font-semibold text-white">Bah!Company</span>
          <span className="hidden text-slate-600 sm:inline">/</span>
          <span className="hidden text-sm text-slate-400 sm:inline">BahBoard</span>
        </div>
        <div className="flex items-center gap-2">
          {onCreateTicket && (
            <button
              onClick={onCreateTicket}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Novo</span>
            </button>
          )}
          <NotificationCenter />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 overflow-x-auto px-4 sm:px-5">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href as any}
              className={cn(
                'relative whitespace-nowrap px-3 py-2 text-xs font-medium transition',
                active
                  ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:bg-accent'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
