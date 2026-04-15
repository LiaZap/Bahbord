'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Trash2, UserPlus, UserMinus, Pencil, X, ChevronDown, Shield } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';

interface Member {
  id: string;
  display_name: string;
  email: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  member_count: number;
  members: Member[];
}

interface AvailableMember {
  id: string;
  display_name: string;
  email: string;
}

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMembers, setAllMembers] = useState<AvailableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');

  // Add member
  const [addingMemberTeam, setAddingMemberTeam] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [teamsRes, membersRes] = await Promise.all([
        fetch('/api/teams').then((r) => r.json()),
        fetch('/api/options?type=members').then((r) => r.json()),
      ]);
      setTeams(teamsRes);
      setAllMembers(membersRes);
    } catch (err) {
      console.error('Erro ao carregar equipes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null, color: newColor }),
      });
      if (res.ok) {
        toast('Equipe criada', 'success');
        setShowCreate(false);
        setNewName('');
        setNewDescription('');
        setNewColor('#6366f1');
        loadData();
      }
    } catch {
      toast('Erro ao criar equipe', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta equipe?')) return;
    try {
      await fetch(`/api/teams?id=${id}`, { method: 'DELETE' });
      toast('Equipe excluída', 'success');
      setTeams((prev) => prev.filter((t) => t.id !== id));
      if (expandedTeam === id) setExpandedTeam(null);
    } catch {
      toast('Erro ao excluir', 'error');
    }
  }

  async function handleUpdate(id: string) {
    try {
      const res = await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editName, description: editDescription || null, color: editColor }),
      });
      if (res.ok) {
        toast('Equipe atualizada', 'success');
        setEditingTeam(null);
        loadData();
      }
    } catch {
      toast('Erro ao atualizar', 'error');
    }
  }

  async function handleAddMember(teamId: string) {
    if (!selectedMemberId) return;
    try {
      await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: teamId, action: 'add_member', member_id: selectedMemberId, role: selectedRole }),
      });
      toast('Membro adicionado', 'success');
      setAddingMemberTeam(null);
      setSelectedMemberId('');
      setSelectedRole('member');
      loadData();
    } catch {
      toast('Erro ao adicionar membro', 'error');
    }
  }

  async function handleRemoveMember(teamId: string, memberId: string) {
    try {
      await fetch('/api/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: teamId, action: 'remove_member', member_id: memberId }),
      });
      toast('Membro removido', 'success');
      loadData();
    } catch {
      toast('Erro ao remover membro', 'error');
    }
  }

  function startEditing(team: Team) {
    setEditingTeam(team.id);
    setEditName(team.name);
    setEditDescription(team.description || '');
    setEditColor(team.color);
  }

  function getAvailableMembers(team: Team) {
    const teamMemberIds = new Set(team.members.map((m) => m.id));
    return allMembers.filter((m) => !teamMemberIds.has(m.id));
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Equipes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {teams.length} equipe{teams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <Plus size={15} />
          Nova equipe
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-accent/30 bg-surface2 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Criar equipe</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Nome</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Frontend, Backend, Design"
                className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Cor</label>
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border-0 bg-transparent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Descrição</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Descrição opcional da equipe"
                className="w-full rounded border border-border/40 bg-surface px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
              Criar
            </button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-slate-500 hover:text-slate-300">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Teams grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const isExpanded = expandedTeam === team.id;
          const isEditing = editingTeam === team.id;
          const available = getAvailableMembers(team);

          return (
            <div
              key={team.id}
              className={`rounded-lg border border-border/40 bg-surface2 transition hover:border-white/[0.12] ${
                isExpanded ? 'sm:col-span-2 lg:col-span-3' : ''
              }`}
            >
              {/* Card header */}
              <div
                className="cursor-pointer p-5"
                onClick={() => {
                  setExpandedTeam(isExpanded ? null : team.id);
                  setEditingTeam(null);
                  setAddingMemberTeam(null);
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: team.color }}
                  >
                    <Users size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-white truncate">{team.name}</h3>
                    {team.description && (
                      <p className="text-[12px] text-slate-500 truncate">{team.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(team);
                        setExpandedTeam(team.id);
                      }}
                      className="rounded p-1 text-slate-600 hover:text-slate-300"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(team.id);
                      }}
                      className="rounded p-1 text-slate-600 hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Member avatars + count */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {team.members.slice(0, 5).map((m) => (
                      <Avatar key={m.id} name={m.display_name} size="xs" className="ring-2 ring-surface2" />
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {team.member_count} membro{team.member_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-border/30 p-5 space-y-4">
                  {/* Edit form */}
                  {isEditing && (
                    <div className="rounded-md border border-border/30 bg-surface p-4 space-y-3">
                      <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">Editar equipe</h4>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">Nome</label>
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded border border-border/40 bg-surface2 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">Descrição</label>
                          <input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full rounded border border-border/40 bg-surface2 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">Cor</label>
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(team.id)}
                          className="rounded bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-500"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingTeam(null)}
                          className="text-[12px] text-slate-500 hover:text-slate-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Members list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">Membros</h4>
                      <button
                        onClick={() => setAddingMemberTeam(addingMemberTeam === team.id ? null : team.id)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-accent hover:bg-white/[0.04]"
                      >
                        <UserPlus size={12} />
                        Adicionar membro
                      </button>
                    </div>

                    {/* Add member form */}
                    {addingMemberTeam === team.id && (
                      <div className="mb-3 flex items-center gap-2 rounded-md border border-border/30 bg-surface p-3">
                        <select
                          value={selectedMemberId}
                          onChange={(e) => setSelectedMemberId(e.target.value)}
                          className="flex-1 rounded border border-border/40 bg-surface2 px-2 py-1.5 text-sm text-slate-200 outline-none"
                        >
                          <option value="">Selecionar membro...</option>
                          {available.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="rounded border border-border/40 bg-surface2 px-2 py-1.5 text-sm text-slate-200 outline-none"
                        >
                          <option value="member">Membro</option>
                          <option value="lead">Lead</option>
                        </select>
                        <button
                          onClick={() => handleAddMember(team.id)}
                          disabled={!selectedMemberId}
                          className="rounded bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-blue-500 disabled:opacity-40"
                        >
                          Adicionar
                        </button>
                        <button
                          onClick={() => {
                            setAddingMemberTeam(null);
                            setSelectedMemberId('');
                          }}
                          className="rounded p-1 text-slate-500 hover:text-slate-300"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Member rows */}
                    {team.members.length === 0 ? (
                      <p className="text-[12px] text-slate-600 italic">Nenhum membro nesta equipe</p>
                    ) : (
                      <div className="space-y-1">
                        {team.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/[0.03]"
                          >
                            <Avatar name={member.display_name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-medium text-slate-200 truncate block">
                                {member.display_name}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate block">{member.email}</span>
                            </div>
                            {member.role === 'lead' && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                                <Shield size={10} />
                                Lead
                              </span>
                            )}
                            {member.role === 'member' && (
                              <span className="text-[10px] text-slate-600">Membro</span>
                            )}
                            <button
                              onClick={() => handleRemoveMember(team.id, member.id)}
                              className="rounded p-1 text-slate-600 hover:text-red-400"
                              title="Remover membro"
                            >
                              <UserMinus size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {teams.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={40} className="mb-3 text-slate-600" />
          <p className="text-sm text-slate-500">Nenhuma equipe criada ainda</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-sm font-medium text-accent hover:text-blue-400"
          >
            Criar primeira equipe
          </button>
        </div>
      )}
    </div>
  );
}
