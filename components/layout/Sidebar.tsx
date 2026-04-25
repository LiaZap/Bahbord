'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard, Search, Settings, Bell,
  Menu, X, PanelLeftClose, PanelLeft, Plus,
  FolderKanban, History, Filter, Users, BookOpen, FileBarChart, Columns3, Zap, Clock,
  Inbox, Star, Calendar
} from 'lucide-react';
import { useProject } from '@/lib/project-context';
import ChangelogPanel from '@/components/changelog/ChangelogPanel';
import Tooltip from '@/components/ui/Tooltip';

const SidebarContext = createContext<{ collapsed: boolean }>({ collapsed: false });
export function useSidebar() { return useContext(SidebarContext); }

interface MeData {
  id: string;
  display_name: string;
  email?: string;
  role: string;
  avatar_url?: string;
  is_approved?: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; prefix: string; color: string }>>([]);
  const [boards, setBoards] = useState<Array<{ id: string; name: string; type: string; project_id: string; is_default?: boolean }>>([]);
  const [me, setMe] = useState<MeData | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [counts, setCounts] = useState<{ inbox: number; my_tasks: number; this_week: number }>({ inbox: 0, my_tasks: 0, this_week: 0 });
  const { currentProjectId, setProject, setBoard } = useProject();

  const isAdminUser = me?.role === 'owner' || me?.role === 'admin';
  const isApproved = me?.is_approved !== false;

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/auth/me');
        const meJson = meRes.ok ? await meRes.json() : null;
        const m: MeData | null = meJson?.member ?? null;
        setMe(m);
        const mid = m?.id;

        const [projRes, boardRes] = await Promise.all([
          fetch(mid ? `/api/projects?member_id=${mid}` : '/api/projects'),
          fetch(mid ? `/api/boards?member_id=${mid}` : '/api/boards'),
        ]);
        setProjects(projRes.ok ? await projRes.json() : []);
        setBoards(boardRes.ok ? await boardRes.json() : []);

        const isAdminRole = m?.role === 'owner' || m?.role === 'admin';
        if (isAdminRole) {
          try {
            const apRes = await fetch('/api/approvals?status=pending');
            if (apRes.ok) {
              const data = await apRes.json();
              setPendingApprovals(Array.isArray(data) ? data.length : 0);
            }
          } catch {}
          try {
            const optRes = await fetch('/api/options?type=members');
            if (optRes.ok) {
              const data = await optRes.json();
              setMemberCount(Array.isArray(data) ? data.length : 0);
            }
          } catch {}
        }

        // Personal counts (inbox / my tasks / this week)
        if (mid) {
          try {
            const cRes = await fetch('/api/personal/counts');
            if (cRes.ok) setCounts(await cRes.json());
          } catch {}
        }
      } catch {}
    }
    load();
  }, []);

  function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: typeof LayoutDashboard; badge?: number }) {
    const basePath = href.split('?')[0];
    const active = pathname === basePath;
    const button = (
      <button
        onClick={() => { setMobileOpen(false); window.location.href = href; }}
        className={cn(
          'group flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-[13px] transition-colors',
          active
            ? 'bg-white/[0.06] text-white font-medium'
            : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200',
          collapsed && 'justify-center px-0'
        )}
      >
        <Icon size={15} strokeWidth={active ? 2 : 1.5} className={active ? 'text-[var(--accent)]' : 'text-slate-500 group-hover:text-slate-300'} />
        {!collapsed && <span className="flex-1 text-left">{label}</span>}
        {!collapsed && badge !== undefined && badge > 0 && (
          <span className="tabular-nums rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{badge}</span>
        )}
      </button>
    );
    if (collapsed) {
      return <Tooltip content={label} side="right">{button}</Tooltip>;
    }
    return button;
  }

  function getInitials(name?: string): string {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  function colorFromName(name: string): string {
    const palette = ['#3b6cf5', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  const sidebarContent = (
    <>
      {/* Workspace header */}
      <div className={cn('flex items-center gap-2.5 px-3 py-3', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[11px] font-bold text-white">
            B!
          </div>
        ) : (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent)] text-[12px] font-bold text-white shrink-0">
              B!
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate">Bah!Company</div>
              <div className="text-[10.5px] text-slate-500 mt-px">workspace{memberCount > 0 ? ` · ${memberCount} membros` : ''}</div>
            </div>
            {isAdminUser && (
              <Tooltip content="Novo projeto" side="right">
                <button
                  onClick={() => { window.location.href = '/projects'; }}
                  className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white transition-colors"
                  aria-label="Novo projeto"
                >
                  <Plus size={14} />
                </button>
              </Tooltip>
            )}
            <button onClick={() => setMobileOpen(false)} aria-label="Fechar menu" className="text-slate-500 hover:text-slate-300 md:hidden">
              <X size={16} />
            </button>
          </>
        )}
      </div>

      {/* Search */}
      {!collapsed ? (
        <div className="px-3 pb-3">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-[7px] text-[12px] text-slate-500 transition hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-slate-300"
          >
            <Search size={13} />
            <span className="flex-1 text-left">Buscar ou pular pra…</span>
            <kbd className="hidden rounded border border-white/[0.08] bg-white/[0.04] px-1 py-px text-[9px] font-medium text-slate-500 sm:inline">⌘K</kbd>
          </button>
        </div>
      ) : (
        <div className="px-2 pb-2">
          <Tooltip content="Buscar (⌘K)" side="right">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              aria-label="Buscar"
              className="flex w-full items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            >
              <Search size={15} />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Main nav */}
        <nav className="px-3 space-y-0.5">
          {isAdminUser && <NavItem href="/" label="Dashboard" icon={LayoutDashboard} />}
          <NavItem href="/inbox" label="Caixa de entrada" icon={Inbox} badge={counts.inbox} />
          <NavItem href="/my-tasks" label="Minhas tarefas" icon={Star} badge={counts.my_tasks} />
          <NavItem href="/this-week" label="Esta semana" icon={Calendar} badge={counts.this_week} />
          {isAdminUser && <NavItem href="/docs" label="Documentação" icon={BookOpen} />}
          {isAdminUser && <NavItem href="/reports" label="Relatórios" icon={FileBarChart} />}
        </nav>

        {/* PROJETOS section */}
        {!collapsed && projects.length > 0 && (
          <div className="px-3 pt-4 pb-1">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Projetos</span>
              {isAdminUser && (
                <button
                  onClick={() => { window.location.href = '/projects'; }}
                  className="rounded p-0.5 text-slate-600 hover:bg-white/[0.06] hover:text-white transition-colors"
                  aria-label="Novo projeto"
                >
                  <Plus size={11} />
                </button>
              )}
            </div>
            <div className="space-y-px">
              {projects.map((p) => {
                const active = currentProjectId === p.id;
                const projectBoards = boards.filter((b) => b.project_id === p.id);
                const defaultBoard = projectBoards.find((b) => b.is_default) || projectBoards[0];
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProject(p.id);
                      if (defaultBoard) {
                        setBoard(defaultBoard.id);
                        setMobileOpen(false);
                        window.location.href = `/board?board_id=${defaultBoard.id}`;
                      }
                    }}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-[12.5px] transition-colors',
                      active ? 'bg-white/[0.06] text-white font-medium' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="flex-1 truncate text-left">{p.name}</span>
                    <span className="text-[9.5px] font-mono font-medium text-slate-600 group-hover:text-slate-500 tabular-nums">{p.prefix}</span>
                  </button>
                );
              })}
              {isAdminUser && (
                <button
                  onClick={() => { window.location.href = '/projects'; }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-[12px] text-slate-600 hover:bg-white/[0.03] hover:text-slate-400 transition-colors"
                >
                  <FolderKanban size={11} className="text-slate-700" />
                  Todos os projetos
                </button>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE section */}
        {isAdminUser && !collapsed && (
          <div className="px-3 pt-4 pb-2">
            <div className="px-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Workspace</span>
            </div>
            <div className="space-y-0.5">
              <NavItem href="/boards" label="Boards" icon={Columns3} />
              <NavItem href="/sprints" label="Sprints" icon={Zap} />
              <NavItem href="/timesheet" label="Time" icon={Clock} />
              <NavItem href="/clients" label="Clientes" icon={Users} />
              <NavItem href="/teams" label="Equipes" icon={Users} />
              <NavItem href="/filters" label="Filtros" icon={Filter} />
              <button
                onClick={() => setChangelogOpen(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-[6px] text-[13px] text-slate-400 transition hover:bg-white/[0.03] hover:text-slate-200"
              >
                <History size={15} strokeWidth={1.5} className="text-slate-500" />
                Changelog
              </button>
              <NavItem
                href="/settings?tab=approvals"
                label={pendingApprovals > 0 ? `Configurações (${pendingApprovals})` : 'Configurações'}
                icon={Settings}
              />
            </div>
          </div>
        )}

        {/* Approval pending notice */}
        {!isApproved && !collapsed && (
          <div className="mx-3 my-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[12px] font-medium text-amber-400">Aguardando aprovação</p>
            <p className="mt-1 text-[11px] text-slate-500 leading-snug">Seu acesso está sendo analisado pelo administrador.</p>
          </div>
        )}
      </div>

      {/* User profile */}
      {me && (
        <div className={cn('border-t border-white/[0.06] p-2', collapsed && 'px-1')}>
          {collapsed ? (
            <Tooltip content={me.display_name} side="right">
              <button className="flex w-full items-center justify-center rounded-md p-1.5 hover:bg-white/[0.04]">
                {me.avatar_url ? (
                  <img src={me.avatar_url} alt={me.display_name} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: colorFromName(me.display_name) }}
                  >
                    {getInitials(me.display_name)}
                  </div>
                )}
              </button>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
              {me.avatar_url ? (
                <img src={me.avatar_url} alt={me.display_name} className="h-8 w-8 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: colorFromName(me.display_name) }}
                >
                  {getInitials(me.display_name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-white truncate">{me.display_name}</div>
                <div className="text-[10.5px] text-slate-500 capitalize flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {me.role === 'owner' ? 'Owner' : me.role === 'admin' ? 'Admin' : 'Membro'}
                </div>
              </div>
              <button
                onClick={() => setChangelogOpen(true)}
                aria-label="Notificações"
                className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <Bell size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <div className="hidden px-2 pb-2 md:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-400',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed ? <PanelLeft size={14} /> : <><PanelLeftClose size={13} /><span>Recolher</span></>}
        </button>
      </div>
    </>
  );

  if (!isApproved && me) {
    return <SidebarContext.Provider value={{ collapsed: false }}><></></SidebarContext.Provider>;
  }

  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className="fixed left-3 top-3 z-50 rounded-md bg-[var(--card-bg)] p-2 text-slate-400 shadow-lg hover:text-white md:hidden"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      <aside role="navigation" aria-label="Menu principal" className={cn(
        'fixed inset-y-0 left-0 z-50 w-[224px] flex-col bg-sidebar border-r border-white/[0.04] transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0 flex' : '-translate-x-full'
      )}>
        {sidebarContent}
      </aside>

      <aside role="navigation" aria-label="Menu principal" className={cn(
        'hidden shrink-0 flex-col bg-sidebar border-r border-white/[0.04] transition-all duration-200 md:flex',
        collapsed ? 'w-[52px]' : 'w-[224px]'
      )}>
        {sidebarContent}
      </aside>
      <ChangelogPanel isOpen={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </SidebarContext.Provider>
  );
}
