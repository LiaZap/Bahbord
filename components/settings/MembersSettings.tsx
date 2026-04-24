'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Link2, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

interface Member {
  id: string;
  display_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  project_role?: string | null;
  board_name?: string | null;
  is_client?: boolean;
}

interface ProjectGroup {
  project_id: string;
  project_name: string;
  project_color: string | null;
  project_prefix: string | null;
  members: Member[];
}

interface GroupedResponse {
  projects: ProjectGroup[];
  unassigned: Member[];
}

export default function MembersSettings() {
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [unassigned, setUnassigned] = useState<Member[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [assignBoardMemberId, setAssignBoardMemberId] = useState<string | null>(null);
  const [boards, setBoards] = useState<Array<{ id: string; name: string; project_id: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBoard, setSelectedBoard] = useState('');
  const [selectedBoardRole, setSelectedBoardRole] = useState('member');
  const [memberBoards, setMemberBoards] = useState<Array<{ board_id: string; board_name: string; project_name: string; role: string }>>([]);

  async function loadMemberBoards(memberId: string) {
    try {
      const res = await fetch(`/api/members/boards?member_id=${memberId}`);
      if (res.ok) {
        setMemberBoards(await res.json());
      }
    } catch {}
  }

  async function loadGrouped() {
    const res = await fetch('/api/members/grouped-by-project');
    if (res.ok) {
      const data: GroupedResponse = await res.json();
      setGroups(data.projects || []);
      setUnassigned(data.unassigned || []);
      // Default: all collapsed except the first one
      setExpanded((prev) => {
        // preserve previous state if exists, else set default
        if (Object.keys(prev).length > 0) return prev;
        const next: Record<string, boolean> = {};
        (data.projects || []).forEach((p, idx) => {
          next[p.project_id] = idx === 0;
        });
        next['__unassigned__'] = false;
        return next;
      });
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/members/grouped-by-project').then((r) => r.ok ? r.json() : { projects: [], unassigned: [] }),
      fetch('/api/boards').then((r) => r.ok ? r.json() : []),
      fetch('/api/options?type=projects').then((r) => r.ok ? r.json() : []),
    ]).then(([g, b, p]) => {
      setGroups(g.projects || []);
      setUnassigned(g.unassigned || []);
      setBoards(b);
      setProjects(p);
      // Default: all collapsed except the first one
      const next: Record<string, boolean> = {};
      (g.projects || []).forEach((proj: ProjectGroup, idx: number) => {
        next[proj.project_id] = idx === 0;
      });
      next['__unassigned__'] = false;
      setExpanded(next);
      setLoading(false);
    }).catch((err) => { console.error('Erro ao carregar:', err); setLoading(false); });
  }, []);

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function updateMemberEverywhere(id: string, patch: Partial<Member>) {
    setGroups((prev) => prev.map((g) => ({
      ...g,
      members: g.members.map((m) => m.id === id ? { ...m, ...patch } : m),
    })));
    setUnassigned((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  }

  function removeMemberEverywhere(id: string) {
    setGroups((prev) => prev.map((g) => ({
      ...g,
      members: g.members.filter((m) => m.id !== id),
    })));
    setUnassigned((prev) => prev.filter((m) => m.id !== id));
  }

  function findMemberById(id: string): Member | undefined {
    for (const g of groups) {
      const m = g.members.find((x) => x.id === id);
      if (m) return m;
    }
    return unassigned.find((x) => x.id === id);
  }

  async function handleAssignBoard() {
    if (!assignBoardMemberId || !selectedBoard) return;
    const res = await fetch('/api/members/assign-board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: assignBoardMemberId, board_id: selectedBoard, role: selectedBoardRole }),
    });
    if (res.ok) {
      if (assignBoardMemberId) await loadMemberBoards(assignBoardMemberId);
      setSelectedBoard('');
      toast('Board atribuído com sucesso', 'success');
      // Refresh grouped list since access changed
      await loadGrouped();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Erro ao atribuir');
    }
  }

  async function handleRemoveMemberBoard(boardId: string) {
    if (!assignBoardMemberId) return;
    const ok = await confirm({
      title: 'Remover acesso',
      message: 'Deseja remover acesso a este board?',
      confirmText: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch('/api/members/assign-board', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: assignBoardMemberId, board_id: boardId }),
    });
    if (res.ok) {
      await loadMemberBoards(assignBoardMemberId);
      await loadGrouped();
    }
  }

  async function handleRoleChange(id: string, role: string) {
    await fetch('/api/members/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: id, role }),
    });
    updateMemberEverywhere(id, { role });
  }

  async function handlePhoneSave(id: string) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'members', id, phone: phoneValue }),
    });
    updateMemberEverywhere(id, { phone: phoneValue || null });
    setEditingPhoneId(null);
  }

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'members', display_name: inviteName.trim(), email: inviteEmail.trim(), user_id: crypto.randomUUID(), role: 'member' }),
    });
    setInviteName('');
    setInviteEmail('');
    setShowInvite(false);
    await loadGrouped();
  }

  async function handleDeleteMember(id: string) {
    const member = findMemberById(id);
    const ok = await confirm({
      title: 'Remover membro',
      message: `Tem certeza que deseja remover ${member?.display_name || 'este membro'}? Todos os tickets e comentários deste usuário serão preservados mas desvinculados.`,
      confirmText: 'Remover',
      variant: 'danger',
    });
    if (!ok) return;
    const res = await fetch(`/api/settings?table=members&id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      removeMemberEverywhere(id);
      toast('Membro removido', 'success');
    } else {
      const err = await res.json().catch(() => ({}));
      toast(err.error || 'Erro ao remover membro. Pode ter tickets vinculados.', 'error');
    }
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  const renderMemberRow = (m: Member) => (
    <tr key={m.id} className="border-b border-border/20 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar name={m.display_name} imageUrl={m.avatar_url} size="sm" />
          <span className="text-slate-200">{m.display_name}</span>
          {m.is_client && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-400">
              Cliente
            </span>
          )}
          {!m.is_client && (m.role === 'owner' || m.role === 'admin') && (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
              Interno
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-slate-400">{m.email}</td>
      <td className="px-4 py-3 text-slate-400">
        {editingPhoneId === m.id ? (
          <input
            autoFocus
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
            onBlur={() => handlePhoneSave(m.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneSave(m.id); if (e.key === 'Escape') setEditingPhoneId(null); }}
            className="w-full rounded border border-border/40 bg-surface px-2 py-1 text-xs text-slate-200 outline-none"
            placeholder="(00) 00000-0000"
          />
        ) : (
          <button
            onClick={() => { setEditingPhoneId(m.id); setPhoneValue(m.phone || ''); }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            {m.phone || 'Adicionar'}
          </button>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          value={m.role}
          onChange={(e) => handleRoleChange(m.id, e.target.value)}
          className="rounded border border-border/40 bg-surface px-2 py-1 text-xs text-slate-200 outline-none"
        >
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Membro</option>
          <option value="viewer">Visualizador</option>
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => { setAssignBoardMemberId(m.id); loadMemberBoards(m.id); }}
            title="Atribuir acesso a board"
            className="text-slate-600 transition hover:text-accent"
          >
            <Link2 size={14} />
          </button>
          <button onClick={() => handleDeleteMember(m.id)} className="text-slate-600 transition hover:text-danger">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );

  const renderTableHeader = () => (
    <thead>
      <tr className="border-b border-border/40 text-left text-xs text-slate-500">
        <th className="px-4 py-3 font-medium">Membro</th>
        <th className="px-4 py-3 font-medium">Email</th>
        <th className="px-4 py-3 font-medium">Telefone</th>
        <th className="px-4 py-3 font-medium">Função</th>
        <th className="px-4 py-3 font-medium w-16"></th>
      </tr>
    </thead>
  );

  const assignedMember = assignBoardMemberId ? findMemberById(assignBoardMemberId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Membros</h2>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">Membros entram via aprovação</span>
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-surface2 px-2.5 py-1 text-xs text-slate-200 transition hover:border-accent/60 hover:text-accent"
          >
            <UserPlus size={12} /> Convidar
          </button>
        </div>
      </div>

      {showInvite && (
        <div className="rounded-lg border border-border/40 bg-surface2 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Nome"
              className="rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none"
            />
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowInvite(false)} className="btn-premium btn-secondary">Cancelar</button>
            <button onClick={handleInvite} disabled={!inviteName.trim() || !inviteEmail.trim()} className="btn-premium btn-primary disabled:opacity-50">Convidar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {groups.length === 0 && unassigned.length === 0 && (
          <div className="rounded-lg border border-border/40 bg-surface2 p-6 text-center text-sm text-slate-500">
            Nenhum membro encontrado.
          </div>
        )}

        {groups.map((g) => {
          const isOpen = !!expanded[g.project_id];
          return (
            <div key={g.project_id} className="rounded-lg border border-border/40 bg-surface2 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpanded(g.project_id)}
                className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-surface3/40"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown size={14} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: g.project_color || '#3b82f6' }}
                  />
                  <span className="text-sm font-medium text-slate-100">{g.project_name}</span>
                  {g.project_prefix && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">{g.project_prefix}</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {g.members.length} {g.members.length === 1 ? 'membro' : 'membros'}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-border/40">
                  {g.members.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-slate-500">Nenhum membro atribuído.</div>
                  ) : (
                    <table className="w-full text-sm">
                      {renderTableHeader()}
                      <tbody>{g.members.map(renderMemberRow)}</tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {unassigned.length > 0 && (
          <div className="rounded-lg border border-border/40 bg-surface2 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleExpanded('__unassigned__')}
              className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-surface3/40"
            >
              <div className="flex items-center gap-2">
                {expanded['__unassigned__'] ? (
                  <ChevronDown size={14} className="text-slate-400" />
                ) : (
                  <ChevronRight size={14} className="text-slate-400" />
                )}
                <FolderOpen size={14} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-100">Sem projeto</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">admins/não atribuídos</span>
              </div>
              <span className="text-xs text-slate-500">
                {unassigned.length} {unassigned.length === 1 ? 'membro' : 'membros'}
              </span>
            </button>

            {expanded['__unassigned__'] && (
              <div className="border-t border-border/40">
                <table className="w-full text-sm">
                  {renderTableHeader()}
                  <tbody>{unassigned.map(renderMemberRow)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de atribuir board */}
      {assignBoardMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAssignBoardMemberId(null)}>
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Atribuir acesso a board</h3>
            <p className="text-sm text-slate-400 mb-4">
              Membro: <span className="font-medium text-slate-200">{assignedMember?.display_name}</span>
            </p>

            {/* Current board accesses */}
            {memberBoards.length > 0 && (
              <div className="mb-4 space-y-2">
                <label className="block text-xs font-medium text-slate-400">Acessos atuais</label>
                <div className="space-y-1">
                  {memberBoards.map((mb) => (
                    <div key={mb.board_id} className="flex items-center justify-between rounded-md border border-border/40 bg-surface px-3 py-2">
                      <div className="text-sm">
                        <span className="font-medium text-slate-200">{mb.board_name}</span>
                        <span className="text-slate-500 text-xs"> · {mb.project_name} · {mb.role}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMemberBoard(mb.board_id)}
                        className="text-slate-600 hover:text-danger text-xs"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Adicionar novo board</label>
                <select
                  value={selectedBoard}
                  onChange={(e) => setSelectedBoard(e.target.value)}
                  className="input-premium w-full"
                >
                  <option value="">Selecionar board</option>
                  {projects.map((p) => {
                    const projectBoards = boards.filter((b) => b.project_id === p.id);
                    if (projectBoards.length === 0) return null;
                    return (
                      <optgroup key={p.id} label={p.name}>
                        {projectBoards.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Função no board</label>
                <select
                  value={selectedBoardRole}
                  onChange={(e) => setSelectedBoardRole(e.target.value)}
                  className="input-premium w-full"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Membro</option>
                  <option value="viewer">Visualizador</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setAssignBoardMemberId(null); setMemberBoards([]); }} className="btn-premium btn-secondary">
                Fechar
              </button>
              <button onClick={handleAssignBoard} disabled={!selectedBoard} className="btn-premium btn-primary disabled:opacity-50">
                Adicionar board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
