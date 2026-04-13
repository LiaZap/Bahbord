'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { LayoutDashboard, Columns3, List, Inbox, Zap, Search, Settings, ChevronDown, Menu, X, CalendarDays, Clock } from 'lucide-react';

const menu = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/board', label: 'Quadros', icon: Columns3 },
  { href: '/list', label: 'Lista', icon: List },
  { href: '/backlog', label: 'Backlog', icon: Inbox },
  { href: '/sprints', label: 'Sprints', icon: Zap },
  { href: '/timeline', label: 'Cronograma', icon: CalendarDays },
  { href: '/timesheet', label: 'Timesheet', icon: Clock },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Workspace */}
      <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">
          B
        </div>
        <div className="flex flex-1 items-center gap-1">
          <span className="text-sm font-semibold text-white">Bah!Company</span>
          <ChevronDown size={12} className="text-slate-500" />
        </div>
        {/* Close button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="text-slate-500 hover:text-slate-300 lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => {
            // Dispara Ctrl+K para abrir SearchModal
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500 transition hover:bg-input/40 hover:text-slate-300"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Pesquisar</span>
          <kbd className="hidden rounded bg-surface px-1 py-0.5 text-[9px] text-slate-600 sm:inline">Ctrl+K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 pt-1">
        {menu.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href as any}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition',
                active
                  ? 'bg-accent/15 text-white'
                  : 'text-slate-400 hover:bg-input/30 hover:text-slate-200'
              )}
            >
              <Icon size={15} className={active ? 'text-accent' : 'text-slate-500'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 px-3 py-3">
        <Link
          href={"/settings" as any}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition',
            pathname === '/settings'
              ? 'bg-accent/15 text-white'
              : 'text-slate-500 hover:bg-input/30 hover:text-slate-300'
          )}
        >
          <Settings size={15} className={pathname === '/settings' ? 'text-accent' : undefined} />
          Configurações
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-md bg-surface2 p-2 text-slate-400 shadow-lg hover:text-white lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 flex-col bg-sidebar text-slate-300 transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0 flex' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col bg-sidebar text-slate-300 lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
