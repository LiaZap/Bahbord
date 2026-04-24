'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Link2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface Member {
  id: string;
  display_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
}

export default function MembersSettings() {
  const [members, setMembers] = useState<Member[]>([]);
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

  useEffect(() => {
    Promise.all([
      fetch('/api/options?type=members').then((r) => r.json()),
      fetch('/api/boards').then((r) => r.ok ? r.json() : []),
      fetch('/api/options?type=projects').then((r) => r.ok ? r.json() : []),
    ]).then(([m, b, p]) => {
      setMembers(m);
      setBoards(b);
      setProjects(p);
      setLoading(false);
    }).catch((err) => { console.error('Erro ao carregar:', err); setLoading(false); });
  }, []);

  async function handleAssignBoard() {
    if (!assignBoardMemberId || !selectedBoard) return;
    const res = await fetch('/api/members/assign-board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: assignBoardMemberId, board_id: selectedBoard, role: selectedBoardRole }),
    });
    if (res.ok) {
      // Reload member boards to show the newly added one
      if (assignBoardMemberId) await loadMemberBoards(assignBoardMemberId);
      setSelectedBoard('');
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Erro ao atribuir');
    }
  }

  async function handleRemoveMemberBoard(boardId: string) {
    if (!assignBoardMemberId) return;
    if (!confirm('Remover acesso a este board?')) return;
    const res = await fetch('/api/members/assign-board', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: assignBoardMemberId, board_id: boardId }),
    });
    if (res.ok) {
      await loadMemberBoards(assignBoardMemberId);
    }
  }

  async function handleRoleChange(id: string, role: string) {
    await fetch('/api/members/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: id, role }),
    });
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));
  }

  async function handlePhoneSave(id: string) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'members', id, phone: phoneValue }),
    });
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, phone: phoneValue || null } : m));
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
    const res = await fetch('/api/options?type=members');
    if (res.ok) setMembers(await res.json());
  }

  async function handleDeleteMember(id: string) {
    if (!confirm('Remover este membro? Esta ação não pode ser desfeita.')) return;
    const res = await fetch(`/api/settings?table=members&id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
    }
  }

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Membros</h2>
        <span className="text-[11px] text-slate-500">Membros entram via aprovação</span>
      </div>

      <div className="rounded-lg border border-border/40 bg-surface2 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Membro</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Função</th>
              <th className="px-4 py-3 font-medium w-16"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border/20 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={m.display_name} size="sm" />
                    <span className="text-slate-200">{m.display_name}</span>
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de atribuir board */}
      {assignBoardMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setAssignBoardMemberId(null)}>
          <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Atribuir acesso a board</h3>
            <p className="text-sm text-slate-400 mb-4">
              Membro: <span className="font-medium text-slate-200">{members.find(m => m.id === assignBoardMemberId)?.display_name}</span>
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
