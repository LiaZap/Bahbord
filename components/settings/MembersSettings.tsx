'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Trash2, RefreshCw, X, ChevronDown, ChevronRight, FolderOpen, Plus } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

interface ProjectAssignment {
  project_id: string;
  project_name: string;
  project_color: string | null;
  project_prefix: string | null;
  role: string;
}

interface Member {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_approved: boolean;
  is_client: boolean;
  can_track_time: boolean;
  role: string;
  projects: ProjectAssignment[];
}

interface ProjectOption {
  id: string;
  name: string;
  color: string;
}

export default function MembersSettings() {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<{ key: string; rect: DOMRect } | null>(null);

  // Click-outside fecha popover
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-projects-popover]') && !target.closest('[data-projects-popover-portal]')) {
        setOpenPopover(null);
      }
    }
    function onScroll() { setOpenPopover(null); }
    if (openPopover) {
      document.addEventListener('click', onClick);
      window.addEventListener('scroll', onScroll, true);
      return () => {
        document.removeEventListener('click', onClick);
        window.removeEventListener('scroll', onScroll, true);
      };
    }
  }, [openPopover]);

  async function loadAll() {
    setLoadError(null);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch('/api/members/with-projects'),
        fetch('/api/options?type=projects'),
      ]);
      if (mRes.ok) {
        setMembers(await mRes.json());
      } else {
        const err = await mRes.json().catch(() => ({}));
        setLoadError(`${mRes.status}: ${err.error || mRes.statusText}`);
      }
      if (pRes.ok) setProjects(await pRes.json());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro de rede');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Inicializa expanded: primeiro projeto aberto
  useEffect(() => {
    if (projects.length > 0 && Object.keys(expanded).length === 0) {
      const init: Record<string, boolean> = {};
      projects.forEach((p, i) => {
        init[p.id] = i === 0;
      });
      init['__unassigned__'] = false;
      init['__pending__'] = true;
      setExpanded(init);
    }
  }, [projects, expanded]);

  async function handleSyncClerk(autoApprove: boolean) {
    setSyncing(true);
    try {
      const res = await fetch('/api/members/sync-clerk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_approve: autoApprove }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Erro ao sincronizar', 'error');
        return;
      }
      const summary = await res.json();
      toast(
        `${summary.created} criado(s), ${summary.linked_by_email} vinculado(s), ${summary.updated} atualizado(s)`,
        'success'
      );
      await loadAll();
    } catch {
      toast('Falha na sincronização', 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'members',
        display_name: inviteName.trim(),
        email: inviteEmail.trim(),
        user_id: crypto.randomUUID(),
        role: 'member',
      }),
    });
    if (res.ok) {
      toast('Membro criado', 'success');
      setInviteName('');
      setInviteEmail('');
      setShowInvite(false);
      await loadAll();
    }
  }

  async function handleDeleteMember(id: string, name: string) {
    const ok = await confirm({
      title: 'Remover membro',
      message: `Remover ${name}? Tickets e comentários permanecem mas ficam desvinculados.`,
      confirmText: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/settings?table=members&id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      toast('Membro removido', 'success');
    } else {
      const err = await res.json().catch(() => ({}));
      toast(err.error || 'Erro ao remover (membro pode ter tickets vinculados)', 'error');
    }
  }

  async function handleRoleChange(id: string, role: string) {
    await fetch('/api/members/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: id, role }),
    });
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
  }

  async function handleToggleTimeTracking(id: string, current: boolean) {
    const next = !current;
    // Optimistic
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, can_track_time: next } : m)));
    const res = await fetch('/api/members/time-tracking', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: id, can_track_time: next }),
    });
    if (!res.ok) {
      // Revert
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, can_track_time: current } : m)));
      const err = await res.json().catch(() => ({}));
      toast(err.error || 'Erro ao alterar Time Tracking', 'error');
    } else {
      toast(next ? 'Time Tracking liberado' : 'Time Tracking desativado', 'success');
    }
  }

  async function handleApprove(id: string) {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'members', id, is_approved: true }),
    });
    if (res.ok) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, is_approved: true } : m)));
      toast('Membro aprovado', 'success');
    }
  }

  async function handlePhoneSave(id: string) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'members', id, phone: phoneValue }),
    });
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, phone: phoneValue || null } : m)));
    setEditingPhoneId(null);
  }

  async function handleAddProject(memberId: string, projectId: string) {
    if (!projectId) return;
    const res = await fetch('/api/members/assign-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, project_id: projectId, role: 'member' }),
    });
    if (res.ok) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  is_approved: true,
                  projects: m.projects.find((pj) => pj.project_id === projectId)
                    ? m.projects
                    : [
                        ...m.projects,
                        {
                          project_id: project.id,
                          project_name: project.name,
                          project_color: project.color,
                          project_prefix: null,
                          role: 'member',
                        },
                      ],
                }
              : m
          )
        );
      }
      toast('Projeto atribuído', 'success');
    } else {
      toast('Erro ao atribuir projeto', 'error');
    }
  }

  async function handleRemoveProject(memberId: string, projectId: string) {
    const res = await fetch('/api/members/assign-project', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, project_id: projectId }),
    });
    if (res.ok) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, projects: m.projects.filter((p) => p.project_id !== projectId) } : m
        )
      );
    }
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Grouping: members per project + unassigned + pending
  const groups = useMemo(() => {
    const filtered = members.filter((m) => {
      if (!filter) return true;
      const q = filter.toLowerCase();
      return m.display_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    });

    // Pending approval bucket
    const pending = filtered.filter((m) => !m.is_approved);

    // Project buckets
    const projectGroups = projects.map((p) => ({
      key: p.id,
      label: p.name,
      color: p.color,
      members: filtered.filter((m) => m.is_approved && m.projects.find((pj) => pj.project_id === p.id)),
    }));

    // Unassigned bucket: aprovados sem nenhum projeto
    const unassigned = filtered.filter((m) => m.is_approved && m.projects.length === 0);

    return { pending, projectGroups, unassigned };
  }, [members, projects, filter]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="card-premium overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[var(--overlay-hover)] animate-pulse" />
              <div className="h-3 w-32 rounded bg-[var(--overlay-hover)] animate-pulse" />
            </div>
            <div className="h-3 w-16 rounded bg-[var(--overlay-hover)] animate-pulse" />
          </div>
          <div className="border-t border-[var(--card-border)]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="grid grid-cols-[1.5fr_1.5fr_110px_1fr_60px_110px_36px] items-center gap-3 border-b border-[var(--card-border)] px-4 py-3 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-[var(--overlay-hover)] animate-pulse" />
                  <div className="h-3 w-24 rounded bg-[var(--overlay-hover)] animate-pulse" />
                </div>
                <div className="h-3 w-3/4 rounded bg-[var(--overlay-hover)] animate-pulse" />
                <div className="h-7 rounded bg-[var(--overlay-subtle)] animate-pulse" />
                <div className="h-5 w-2/3 rounded bg-[var(--overlay-subtle)] animate-pulse" />
                <div className="h-4 w-7 rounded-full bg-[var(--overlay-subtle)] animate-pulse" />
                <div className="h-3 w-16 rounded bg-[var(--overlay-subtle)] animate-pulse" />
                <div />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderMemberRow(m: Member, options: { showProjectsColumn?: boolean; sectionProjectId?: string } = {}) {
    const { showProjectsColumn = true, sectionProjectId } = options;
    return (
      <div
        key={`${sectionProjectId || 'flat'}-${m.id}`}
        className="grid grid-cols-[1.5fr_1.5fr_110px_1fr_60px_110px_36px] items-center gap-3 border-b border-[var(--card-border)] px-4 py-2.5 last:border-0 hover:bg-[var(--overlay-subtle)]"
      >
        {/* Membro + status */}
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={m.display_name} imageUrl={m.avatar_url} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[13px] text-primary font-medium truncate">{m.display_name || '—'}</span>
              {!m.is_approved && (
                <button
                  onClick={() => handleApprove(m.id)}
                  className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-400 hover:bg-amber-500/25 shrink-0"
                  title="Clique para aprovar"
                >
                  Pendente
                </button>
              )}
              {m.is_client && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-400 shrink-0">
                  Cliente
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="text-[12.5px] text-secondary truncate">{m.email || '—'}</div>

        {/* Role */}
        <div>
          <select
            value={m.role}
            onChange={(e) => handleRoleChange(m.id, e.target.value)}
            className="input-premium !py-1 !px-2 text-[12px] w-full"
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Membro</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        {/* Projetos coluna */}
        <div data-projects-popover>
          {(() => {
            const popoverKey = `${sectionProjectId || 'flat'}-${m.id}`;
            const isOpen = openPopover?.key === popoverKey;

            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isOpen) {
                    setOpenPopover(null);
                  } else {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setOpenPopover({ key: popoverKey, rect });
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition ${
                  isOpen
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-primary'
                    : m.projects.length === 0
                      ? 'border-dashed border-[var(--card-border)] text-secondary hover:border-[var(--accent)]/40 hover:text-primary'
                      : 'border-[var(--card-border)] text-primary hover:border-[var(--accent)]/40'
                }`}
              >
                {m.projects.length === 0 ? (
                  <>
                    <Plus size={11} />
                    <span>Atribuir</span>
                  </>
                ) : (
                  <>
                    <div className="flex -space-x-0.5">
                      {m.projects.slice(0, 3).map((pj) => (
                        <span
                          key={pj.project_id}
                          className="h-2 w-2 rounded-full ring-1 ring-[var(--card-bg)]"
                          style={{ backgroundColor: pj.project_color || '#3b6cf5' }}
                        />
                      ))}
                    </div>
                    <span className="tabular-nums">
                      {m.projects.length} {m.projects.length === 1 ? 'projeto' : 'projetos'}
                    </span>
                    <ChevronDown size={9} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
            );
          })()}
        </div>

        {/* Time Tracking toggle */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => handleToggleTimeTracking(m.id, m.can_track_time)}
            title={m.can_track_time ? 'Desativar Time Tracking pra este usuário' : 'Liberar Time Tracking pra este usuário'}
            aria-pressed={m.can_track_time}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              m.can_track_time ? 'bg-[var(--accent)]' : 'bg-[var(--overlay-hover)]'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                m.can_track_time ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Telefone */}
        <div>
          {editingPhoneId === m.id ? (
            <input
              autoFocus
              value={phoneValue}
              onChange={(e) => setPhoneValue(e.target.value)}
              onBlur={() => handlePhoneSave(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePhoneSave(m.id);
                if (e.key === 'Escape') setEditingPhoneId(null);
              }}
              className="input-premium !py-1 !px-2 text-[12px] w-full"
              placeholder="(00) 00000-0000"
            />
          ) : (
            <button
              onClick={() => {
                setEditingPhoneId(m.id);
                setPhoneValue(m.phone || '');
              }}
              className="text-[12px] text-secondary hover:text-primary"
            >
              {m.phone || '—'}
            </button>
          )}
        </div>

        {/* Delete */}
        <div className="text-right">
          <button
            onClick={() => handleDeleteMember(m.id, m.display_name)}
            className="text-[var(--text-tertiary)] transition hover:text-[var(--danger)] p-1"
            title="Remover membro"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  function renderSectionHeader(label: string, count: number, expanded: boolean, color?: string | null) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown size={13} className="text-secondary" />
          ) : (
            <ChevronRight size={13} className="text-secondary" />
          )}
          {color !== undefined && (
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color || '#71717a' }} />
          )}
          <span className="text-[13px] font-semibold text-primary">{label}</span>
        </div>
        <span className="text-[11px] text-secondary tabular-nums">
          {count} {count === 1 ? 'membro' : 'membros'}
        </span>
      </div>
    );
  }

  function renderColumnHeaders() {
    return (
      <div className="grid grid-cols-[1.5fr_1.5fr_110px_1fr_60px_110px_36px] items-center gap-3 border-b border-[var(--card-border)] bg-[var(--overlay-subtle)] px-4 py-2 text-[10px] uppercase tracking-wider text-secondary font-medium">
        <span>Membro</span>
        <span>Email</span>
        <span>Role</span>
        <span>Projetos</span>
        <span title="Time Tracking">Time</span>
        <span>Telefone</span>
        <span></span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-primary">Membros</h2>
          <p className="text-[12px] text-secondary mt-0.5">
            {members.length} no total{groups.pending.length > 0 && ` · ${groups.pending.length} aguardando aprovação`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleSyncClerk(false)}
            disabled={syncing}
            title="Puxa todos os usuários do Clerk e cria pedidos de aprovação"
            className="btn-premium btn-secondary text-[12px]"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sincronizar Clerk'}
          </button>
          <button
            onClick={() => handleSyncClerk(true)}
            disabled={syncing}
            title="Puxa do Clerk e aprova automaticamente todos"
            className="btn-premium btn-secondary text-[12px] hover:!border-emerald-500/60 hover:!text-emerald-400"
          >
            Sync + auto-aprovar
          </button>
          <button onClick={() => setShowInvite((v) => !v)} className="btn-premium btn-secondary text-[12px]">
            <UserPlus size={12} /> Convidar
          </button>
        </div>
      </div>

      {/* Erro de carregamento */}
      {loadError && (
        <div className="card-premium border-red-500/30 bg-red-500/5 p-4">
          <p className="text-[13px] font-medium text-red-400">Não consegui carregar os membros</p>
          <p className="mt-1 text-[12px] text-red-300/80 font-mono">{loadError}</p>
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="card-premium p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome" className="input-premium" />
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" type="email" className="input-premium" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowInvite(false)} className="btn-premium btn-secondary">Cancelar</button>
            <button
              onClick={handleInvite}
              disabled={!inviteName.trim() || !inviteEmail.trim()}
              className="btn-premium btn-primary disabled:opacity-50"
            >
              Convidar
            </button>
          </div>
        </div>
      )}

      {/* Filtro */}
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Buscar nome ou email…"
        className="input-premium w-full"
      />

      {members.length === 0 && !loadError && (
        <div className="card-premium p-6 text-center text-[13px] text-secondary">
          Nenhum membro encontrado. Clique em &quot;Sincronizar Clerk&quot; pra puxar os usuários.
        </div>
      )}

      <div className="space-y-3">
        {/* Pending bucket */}
        {groups.pending.length > 0 && (
          <div className="card-premium overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpanded('__pending__')}
              className="w-full text-left transition hover:bg-[var(--overlay-subtle)]"
            >
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {expanded['__pending__'] ? (
                    <ChevronDown size={13} className="text-secondary" />
                  ) : (
                    <ChevronRight size={13} className="text-secondary" />
                  )}
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[13px] font-semibold text-primary">Aguardando aprovação</span>
                </div>
                <span className="text-[11px] text-secondary tabular-nums">
                  {groups.pending.length} {groups.pending.length === 1 ? 'membro' : 'membros'}
                </span>
              </div>
            </button>
            {expanded['__pending__'] && (
              <div>
                {renderColumnHeaders()}
                <div>{groups.pending.map((m) => renderMemberRow(m, { showProjectsColumn: true }))}</div>
              </div>
            )}
          </div>
        )}

        {/* Per-project buckets */}
        {groups.projectGroups.map((g) => (
          <div key={g.key} className="card-premium overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpanded(g.key)}
              className="w-full text-left transition hover:bg-[var(--overlay-subtle)]"
            >
              {renderSectionHeader(g.label, g.members.length, !!expanded[g.key], g.color)}
            </button>
            {expanded[g.key] && (
              <div>
                {renderColumnHeaders()}
                {g.members.length === 0 ? (
                  <div className="px-4 py-4 text-[12px] text-secondary">Nenhum membro neste projeto.</div>
                ) : (
                  <div>
                    {g.members.map((m) => renderMemberRow(m, { showProjectsColumn: false, sectionProjectId: g.key }))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Sem projeto */}
        {groups.unassigned.length > 0 && (
          <div className="card-premium overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpanded('__unassigned__')}
              className="w-full text-left transition hover:bg-[var(--overlay-subtle)]"
            >
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {expanded['__unassigned__'] ? (
                    <ChevronDown size={13} className="text-secondary" />
                  ) : (
                    <ChevronRight size={13} className="text-secondary" />
                  )}
                  <FolderOpen size={13} className="text-secondary" />
                  <span className="text-[13px] font-semibold text-primary">Sem projeto</span>
                  <span className="text-[10px] uppercase tracking-wider text-secondary">admins / não atribuídos</span>
                </div>
                <span className="text-[11px] text-secondary tabular-nums">
                  {groups.unassigned.length} {groups.unassigned.length === 1 ? 'membro' : 'membros'}
                </span>
              </div>
            </button>
            {expanded['__unassigned__'] && (
              <div>
                {renderColumnHeaders()}
                <div>{groups.unassigned.map((m) => renderMemberRow(m, { showProjectsColumn: true }))}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Popover de projetos (portal — fora do overflow das sections) */}
      {openPopover && typeof window !== 'undefined' && createPortal(
        (() => {
          const memberId = openPopover.key.split('-').slice(1).join('-');
          const member = members.find((mm) => mm.id === memberId);
          if (!member) return null;
          const sectionId = openPopover.key.split('-')[0];
          const sectionProjectIdActual = sectionId !== 'flat' ? sectionId : undefined;
          const availableToAdd = projects.filter(
            (p) => !member.projects.find((pj) => pj.project_id === p.id)
          );
          // Posiciona abaixo do botão; se não couber, acima
          const POPOVER_HEIGHT = 320;
          const spaceBelow = window.innerHeight - openPopover.rect.bottom;
          const above = spaceBelow < POPOVER_HEIGHT && openPopover.rect.top > POPOVER_HEIGHT;
          const top = above
            ? openPopover.rect.top - 4
            : openPopover.rect.bottom + 4;
          const left = Math.min(
            openPopover.rect.left,
            window.innerWidth - 280
          );
          return (
            <div
              data-projects-popover-portal
              className="fixed z-[100] w-[260px] rounded-md border border-[var(--card-border)] bg-[var(--modal-bg)] shadow-2xl shadow-black/50"
              style={{
                top: above ? undefined : top,
                bottom: above ? window.innerHeight - top : undefined,
                left,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-[var(--card-border)] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Projetos do membro</p>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {member.projects.length === 0 ? (
                  <p className="px-3 py-3 text-[12px] text-secondary italic">Nenhum projeto atribuído</p>
                ) : (
                  member.projects.map((pj) => (
                    <div
                      key={pj.project_id}
                      className={`flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-[var(--overlay-subtle)] ${
                        pj.project_id === sectionProjectIdActual ? 'bg-[var(--accent)]/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: pj.project_color || '#3b6cf5' }}
                        />
                        <span className="text-[12px] text-primary truncate">{pj.project_name}</span>
                        {pj.project_id === sectionProjectIdActual && (
                          <span className="text-[9px] uppercase tracking-wider text-[var(--accent)] shrink-0">atual</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveProject(member.id, pj.project_id)}
                        className="shrink-0 rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                        title="Remover deste projeto"
                        aria-label={`Remover ${pj.project_name}`}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              {availableToAdd.length > 0 && (
                <div className="border-t border-[var(--card-border)] p-2">
                  <select
                    value=""
                    onChange={(e) => {
                      handleAddProject(member.id, e.target.value);
                      setOpenPopover(null);
                    }}
                    className="input-premium w-full text-[12px]"
                  >
                    <option value="">+ Adicionar a outro projeto…</option>
                    {availableToAdd.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}
