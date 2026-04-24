'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Columns3, List, Inbox, Zap, CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const tabs = [
  { href: '/board', label: 'Quadro', icon: Columns3 },
  { href: '/list', label: 'Lista', icon: List },
  { href: '/backlog', label: 'Backlog', icon: Inbox },
  { href: '/sprints', label: 'Sprints', icon: Zap, adminOnly: true },
  { href: '/timeline', label: 'Cronograma', icon: CalendarDays, adminOnly: true },
  { href: '/timesheet', label: 'Timesheet', icon: Clock, adminOnly: true },
];

interface ViewTabsProps {
  isAdmin?: boolean;
}

export default function ViewTabs({ isAdmin = false }: ViewTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const boardId = searchParams.get('board_id');
  const queryString = boardId ? `?board_id=${boardId}` : '';

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="flex items-center gap-1 border-b border-white/[0.06] px-5">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${queryString}` as any}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition-all border-b-2 -mb-px',
              active
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            )}
          >
            <Icon size={13} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
