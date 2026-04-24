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

const mainNavBase = [
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const { currentProjectId, currentBoardId, recentBoards, setProject, setBoard } = useProject();

  const isAdminUser = userRole === 'owner' || userRole === 'admin';

  // Carregar projetos filtrados por acesso do membro logado
  useEffect(() => {
    async function loadUserProjects() {
      try {
        const meRes = await fetch('/api/auth/me');
        const me = meRes.ok ? await meRes.json() : null;
        const mid = me?.member?.id;
        setUserRole(me?.member?.role || null);
        setIsApproved(me?.member?.is_approved !== false);
        const [projRes, boardRes] = await Promise.all([
          fetch(mid ? `/api/projects?member_id=${mid}` : '/api/projects'),
          fetch(mid ? `/api/boards?member_id=${mid}` : '/api/boards'),
        ]);
        setProjects(projRes.ok ? await projRes.json() : []);
        setBoards(boardRes.ok ? await boardRes.json() : []);

        // Load pending approvals count for admins
        const isAdminRole = me?.member?.role === 'owner' || me?.member?.role === 'admin';
        if (isAdminRole) {
          try {
            const apRes = await fetch('/api/approvals?status=pending');
            if (apRes.ok) {
              const data = await apRes.json();
              setPendingApprovals(Array.isArray(data) ? data.length : 0);
            }
          } catch {}
        }
      } catch {}
    }
    loadUserProjects();
  }, []);

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) {
    const basePath = href.split('?')[0];
    const active = pathname === basePath;
    return (
      <button
        onClick={() => { setMobileOpen(false); window.location.href = href; }}
        title={collapsed ? label : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100',
          active
            ? 'bg-white/[0.08] text-white'
            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
          collapsed && 'justify-center px-0'
        )}
      >
        <Icon size={16} strokeWidth={active ? 2 : 1.5} className={active ? 'text-blue-400' : 'text-slate-500'} />
        {!collapsed && label}
        {!collapsed && active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
      </button>
    );
  }

  const sidebarContent = (
    <>
      {/* Organization header (top level) */}
      <div className={cn('flex items-center gap-2.5 px-4 py-3', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <img src="/logo-bahtech.svg" alt="BahTech" className="h-6 w-6 object-contain object-left shrink-0 dark:invert-0 invert" />
        ) : (
          <div className="flex-1 min-w-0">
            <img src="/logo-bahtech.svg" alt="BahTech" className="h-5 object-contain object-left dark:invert-0 invert" />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Organização</span>
          </div>
        )}
        <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="text-slate-500 hover:text-slate-300 md:hidden">
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
            aria-label="Pesquisar"
            className="flex w-full items-center justify-center rounded-md p-2 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
          >
            <Search size={16} />
          </button>
        </div>
      )}

      {/* Hierarchy: Projects → Boards */}
      {!collapsed && projects.length > 0 && (
        <div className="px-3 pb-2">
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
                        <button
                          key={b.id}
                          onClick={() => { setBoard(b.id); setMobileOpen(false); window.location.href = `/board?board_id=${b.id}`; }}
                          className="flex w-full items-center gap-1.5 truncate rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 text-left"
                        >
                          <Columns3 size={11} className="text-slate-600 shrink-0" />
                          {b.name}
                        </button>
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
        {isAdminUser && <NavItem href="/" label="Dashboard" icon={LayoutDashboard} />}
        {isAdminUser && <NavItem href="/docs" label="Documentação" icon={BookOpen} />}

        {!collapsed && (
          <div className="pt-2 pb-0.5">
            <span className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Visualizações</span>
          </div>
        )}
        {collapsed && <div className="my-2 mx-2 h-px bg-white/[0.06]" />}
        {mainNavBase.map((item) => {
          const boardParam = currentBoardId ? `?board_id=${currentBoardId}` : '';
          return <NavItem key={item.href} {...item} href={`${item.href}${boardParam}`} />;
        })}

        {isAdminUser && (!collapsed ? (
          <button
            onClick={() => setPlanningOpen(!planningOpen)}
            className="mt-2 flex w-full items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-400"
          >
            <ChevronRight size={11} className={cn('transition-transform', planningOpen && 'rotate-90')} />
            Planejamento
          </button>
        ) : (
          <div className="my-2 mx-2 h-px bg-white/[0.06]" />
        ))}
        {isAdminUser && (collapsed || planningOpen) && planningNav.map((item) => <NavItem key={item.href} {...item} />)}
      </nav>

      {/* Aguardando aprovação */}
      {!isApproved && !collapsed && (
        <div className="mx-3 mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[12px] font-medium text-amber-400">Aguardando aprovação</p>
          <p className="mt-1 text-[11px] text-slate-500">Seu acesso está sendo analisado pelo administrador.</p>
        </div>
      )}

      {/* Footer */}
      <div className="mx-3 h-px bg-white/[0.06]" />
      <div className="px-3 py-2 space-y-0.5">
        {isAdminUser && <NavItem href="/filters" label="Filtros" icon={Filter} />}
        {isAdminUser && <NavItem href="/projects" label="Projetos" icon={FolderKanban} />}
        {isAdminUser && <NavItem href="/clients" label="Clientes" icon={Users} />}
        {isAdminUser && <NavItem href="/teams" label="Equipes" icon={Users} />}
        {isAdminUser && (!collapsed ? (
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
        ))}
        {isAdminUser && <NavItem href="/settings?tab=approvals" label={pendingApprovals > 0 ? `Aprovações (${pendingApprovals})` : 'Configurações'} icon={Settings} />}
      </div>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden px-3 pb-3 md:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
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

  // Hide sidebar for unapproved users
  if (!isApproved) {
    return <SidebarContext.Provider value={{ collapsed: false }}><></></SidebarContext.Provider>;
  }

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className="fixed left-3 top-3 z-50 rounded-md bg-[var(--card-bg)] p-2 text-slate-400 shadow-lg hover:text-white md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside role="navigation" aria-label="Menu principal" className={cn(
        'fixed inset-y-0 left-0 z-50 w-[240px] flex-col bg-sidebar transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0 flex' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside role="navigation" aria-label="Menu principal" className={cn(
        'hidden shrink-0 flex-col bg-sidebar transition-all duration-200 md:flex',
        collapsed ? 'w-[56px]' : 'w-[240px]'
      )}>
        {sidebarContent}
      </aside>
      <ChangelogPanel isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </SidebarContext.Provider>
  );
}
