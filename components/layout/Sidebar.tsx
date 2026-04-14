'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard, Columns3, List, Inbox, Zap, Search, Settings,
  ChevronDown, Menu, X, CalendarDays, Clock, ChevronRight
} from 'lucide-react';

const mainNav = [
  { href: '/board', label: 'Quadro', icon: Columns3 },
  { href: '/list', label: 'Lista', icon: List },
  { href: '/backlog', label: 'Backlog', icon: Inbox },
];

const planningNav = [
  { href: '/sprints', label: 'Sprints', icon: Zap },
  { href: '/timeline', label: 'Cronograma', icon: CalendarDays },
  { href: '/timesheet', label: 'Timesheet', icon: Clock },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(true);

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) {
    const active = pathname === href;
    return (
      <Link
        href={href as any}
        onClick={() => setMobileOpen(false)}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100',
          active
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
        )}
      >
        <Icon size={16} strokeWidth={active ? 2 : 1.5} className={active ? 'text-blue-400' : 'text-slate-500'} />
        {label}
        {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-sm font-bold text-white shadow-md shadow-blue-500/20">
          B
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-semibold text-white truncate">Bah!Company</span>
            <ChevronDown size={12} className="shrink-0 text-slate-500" />
          </div>
          <span className="text-[11px] text-slate-500">Projeto de software</span>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="text-slate-500 hover:text-slate-300 lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mx-3 mb-3 h-px bg-white/[0.06]" />

      {/* Search */}
      <div className="px-3 pb-2">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="flex w-full items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-[7px] text-[12px] text-slate-500 transition hover:border-white/[0.1] hover:bg-white/[0.05]"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Pesquisar...</span>
          <kbd className="hidden rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-600 sm:inline">/</kbd>
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-0.5 px-3">
        <NavItem href="/" label="Dashboard" icon={LayoutDashboard} />

        <div className="pt-1 pb-0.5">
          <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Visualizações</span>
        </div>
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}

        {/* Planning section - collapsible */}
        <button
          onClick={() => setPlanningOpen(!planningOpen)}
          className="mt-2 flex w-full items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-400"
        >
          <ChevronRight size={11} className={cn('transition-transform', planningOpen && 'rotate-90')} />
          Planejamento
        </button>
        {planningOpen && planningNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="mx-3 h-px bg-white/[0.06]" />
      <div className="px-3 py-3">
        <NavItem href="/settings" label="Configurações" icon={Settings} />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-md bg-surface2 p-2 text-slate-400 shadow-lg hover:text-white lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-[240px] flex-col bg-[#161819] transition-transform duration-200 lg:hidden',
        mobileOpen ? 'translate-x-0 flex' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-[240px] shrink-0 flex-col bg-[#161819] lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
