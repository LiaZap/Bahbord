'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard, Columns3, List, Inbox, Zap, Search, Settings,
  ChevronDown, Menu, X, CalendarDays, Clock, ChevronRight, PanelLeftClose, PanelLeft,
  FolderKanban, History, Filter, Users, BookOpen
} from 'lucide-react';
import { useProject } from '@/lib/project-context';
import ChangelogPanel from '@/components/changelog/ChangelogPanel';

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

// Context para outros componentes saberem se sidebar está collapsed
const SidebarContext = createContext<{ collapsed: boolean }>({ collapsed: false });
export function useSidebar() { return useContext(SidebarContext); }

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(true);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; prefix: string; color: string }>>([]);
  const [boards, setBoards] = useState<Array<{ id: string; name: string; type: string; project_id: string }>>([]);
  const { currentProjectId, recentBoards, setProject, setBoard } = useProject();

  // Carregar projetos filtrados por acesso do membro logado
  useEffect(() => {
    async function loadUserProjects() {
      try {
        const meRes = await fetch('/api/auth/me');
        const me = meRes.ok ? await meRes.json() : null;
        const mid = me?.member?.id;
        const projRes = await fetch(mid ? `/api/projects?member_id=${mid}` : '/api/projects');
        const projs = projRes.ok ? await projRes.json() : [];
        setProjects(projs);
        const boardResults = await Promise.all(
          projs.map(async (p: { id: string }) => {
            const bRes = await fetch(`/api/boards?project_id=${p.id}${mid ? `&member_id=${mid}` : ''}`);
            return bRes.ok ? bRes.json() : [];
          })
        );
        setBoards(boardResults.flat());
      } catch {}
    }
    loadUserProjects();
  }, []);

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) {
    const active = pathname === href;
    return (
      <Link
        href={href as any}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? label : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100',
          active
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
          collapsed && 'justify-center px-0'
        )}
      >
        <Icon size={16} strokeWidth={active ? 2 : 1.5} className={active ? 'text-blue-400' : 'text-slate-500'} />
        {!collapsed && label}
        {!collapsed && active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {/* Organization header (top level) */}
      <div className={cn('flex items-center gap-2.5 px-4 py-3', collapsed && 'justify-center px-2')}>
        <img src="/logo-bah.svg" alt="Bah!" className="h-7 w-7 rounded-md object-contain shrink-0" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-[14px] font-bold text-white truncate block">BahTech</span>
            <span className="text-[10px] text-slate-500">Organização</span>
          </div>
        )}
        <button onClick={() => setMobileOpen(false)} className="text-slate-500 hover:text-slate-300 md:hidden">
          <X size={18} />
        </button>
      </div>

      {!collapsed && <div className="mx-3 mb-1 h-px bg-white/[0.06]" />}

      {/* Search */}
      {!collapsed ? (
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
      ) : (
        <div className="px-2 pb-2">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            title="Pesquisar (Ctrl+K)"
            className="flex w-full items-center justify-center rounded-md p-2 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
          >
            <Search size={16} />
          </button>
        </div>
      )}

      {/* Hierarchy: Projects → Boards */}
      {!collapsed && projects.length > 0 && (
        <div className="px-3 pb-2">
          {/* Recent boards */}
          {recentBoards.length > 0 && (
            <>
              <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Recentes</span>
              <div className="mt-1 mb-2 space-y-0.5">
                {recentBoards.map((rb) => (
                  <Link
                    key={rb.id}
                    href="/board"
                    onClick={() => setBoard(rb.id)}
                    className="flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                  >
                    <Columns3 size={12} className="text-slate-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="block truncate text-slate-400">{rb.name}</span>
                      <span className="text-[9px] text-slate-600">{rb.projectName}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Projects with boards */}
          <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Projetos</span>
          <div className="mt-1 space-y-0.5">
            {projects.map((p) => {
              const active = currentProjectId === p.id;
              const projectBoards = boards.filter((b) => b.project_id === p.id);
              return (
                <div key={p.id}>
                  <button
                    onClick={() => setProject(p.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-[6px] text-[12px] font-medium transition',
                      active ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    )}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: p.color }}>
                      {p.prefix.substring(0, 2)}
                    </span>
                    <span className="truncate">{p.name}</span>
                    <ChevronRight size={11} className={cn('ml-auto shrink-0 text-slate-600 transition-transform', active && 'rotate-90')} />
                  </button>
                  {active && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-2">
                      {projectBoards.map((b) => (
                        <Link
                          key={b.id}
                          href="/board"
                          onClick={() => setBoard(b.id)}
                          className="flex items-center gap-1.5 truncate rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
                        >
                          <Columns3 size={11} className="text-slate-600 shrink-0" />
                          {b.name}
                        </Link>
                      ))}
                      <Link
                        href="/boards"
                        className="block px-2 py-1 text-[10px] text-slate-600 hover:text-blue-400"
                      >
                        Ver todos os boards
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mx-2.5 mt-2 h-px bg-white/[0.06]" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
        <NavItem href="/" label="Dashboard" icon={LayoutDashboard} />
        <NavItem href="/docs" label="Documentação" icon={BookOpen} />

        {!collapsed && (
          <div className="pt-2 pb-0.5">
            <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Visualizações</span>
          </div>
        )}
        {collapsed && <div className="my-2 mx-2 h-px bg-white/[0.06]" />}
        {mainNav.map((item) => <NavItem key={item.href} {...item} />)}

        {!collapsed ? (
          <button
            onClick={() => setPlanningOpen(!planningOpen)}
            className="mt-2 flex w-full items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-400"
          >
            <ChevronRight size={11} className={cn('transition-transform', planningOpen && 'rotate-90')} />
            Planejamento
          </button>
        ) : (
          <div className="my-2 mx-2 h-px bg-white/[0.06]" />
        )}
        {(collapsed || planningOpen) && planningNav.map((item) => <NavItem key={item.href} {...item} />)}
      </nav>

      {/* Footer */}
      <div className="mx-3 h-px bg-white/[0.06]" />
      <div className="px-3 py-2 space-y-0.5">
        <NavItem href="/filters" label="Filtros" icon={Filter} />
        <NavItem href="/projects" label="Projetos" icon={FolderKanban} />
        <NavItem href="/clients" label="Clientes" icon={Users} />
        <NavItem href="/teams" label="Equipes" icon={Users} />
        {!collapsed ? (
          <button
            onClick={() => setChangelogOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
          >
            <History size={16} strokeWidth={1.5} className="text-slate-500" />
            Changelog
          </button>
        ) : (
          <button
            onClick={() => setChangelogOpen(true)}
            title="Changelog"
            className="flex w-full items-center justify-center rounded-md p-2 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
          >
            <History size={16} />
          </button>
        )}
        <NavItem href="/settings" label="Configurações" icon={Settings} />
      </div>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden px-3 pb-3 md:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2.5 py-[6px] text-[12px] text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-400',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? <PanelLeft size={16} /> : <><PanelLeftClose size={14} /><span>Recolher</span></>}
        </button>
      </div>
    </>
  );

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-md bg-[#232730] p-2 text-slate-400 shadow-lg hover:text-white md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-[240px] flex-col bg-[#161819] transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0 flex' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden shrink-0 flex-col bg-[#161819] transition-all duration-200 md:flex',
        collapsed ? 'w-[56px]' : 'w-[240px]'
      )}>
        {sidebarContent}
      </aside>
      <ChangelogPanel isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </SidebarContext.Provider>
  );
}
