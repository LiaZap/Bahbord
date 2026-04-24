'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash2, RefreshCw, X, Plus } from 'lucide-react';
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
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  async function loadAll() {
    try {
      const [mRes, pRes] = await Promise.all([
        fetch('/api/members/with-projects'),
        fetch('/api/options?type=projects'),
      ]);
      if (mRes.ok) setMembers(await mRes.json());
      if (pRes.ok) setProjects(await pRes.json());
    } catch (err) {
      console.error('Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

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

  const filtered = members.filter((m) => {
    if (showOnlyPending && m.is_approved) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return m.display_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    }
    return true;
  });

  const pendingCount = members.filter((m) => !m.is_approved).length;

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
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
            {members.length} no total{pendingCount > 0 && ` · ${pendingCount} aguardando aprovação`}
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

      {/* Invite form */}
      {showInvite && (
        <div className="card-premium p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Nome"
              className="input-premium"
            />
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="input-premium"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowInvite(false)} className="btn-premium btn-secondary">
              Cancelar
            </button>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar nome ou email…"
          className="input-premium flex-1 min-w-[180px]"
        />
        <button
          onClick={() => setShowOnlyPending((v) => !v)}
          className={`btn-premium btn-secondary text-[12px] ${
            showOnlyPending ? '!border-amber-500/60 !text-amber-400' : ''
          }`}
        >
          {showOnlyPending ? 'Mostrando pendentes' : 'Só pendentes'}
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card-premium p-6 text-center text-[13px] text-secondary">
          Nenhum membro encontrado.
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--card-border)] text-left text-[11px] uppercase tracking-wider text-secondary">
                <th className="px-3 py-2.5 font-medium">Membro</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Projetos</th>
                <th className="px-3 py-2.5 font-medium">Telefone</th>
                <th className="px-3 py-2.5 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-[var(--card-border)] last:border-0 align-middle hover:bg-[var(--overlay-subtle)]">
                  {/* Nome + status */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.display_name} imageUrl={m.avatar_url} size="sm" />
                      <span className="text-primary font-medium">{m.display_name || '—'}</span>
                      {!m.is_approved && (
                        <button
                          onClick={() => handleApprove(m.id)}
                          className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400 hover:bg-amber-500/25"
                          title="Clique para aprovar"
                        >
                          Pendente
                        </button>
                      )}
                      {m.is_client && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-400">
                          Cliente
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-3 py-2.5 text-secondary truncate max-w-[200px]">{m.email || '—'}</td>

                  {/* Role */}
                  <td className="px-3 py-2.5">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="input-premium !py-1 !px-2 text-[12px]"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Membro</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>

                  {/* Projetos atribuídos + dropdown pra adicionar */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {m.projects.map((pj) => (
                        <span
                          key={pj.project_id}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: (pj.project_color || '#3b6cf5') + '20',
                            color: pj.project_color || '#3b6cf5',
                          }}
                        >
                          {pj.project_name}
                          <button
                            onClick={() => handleRemoveProject(m.id, pj.project_id)}
                            className="opacity-60 hover:opacity-100"
                            aria-label={`Remover ${pj.project_name}`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      <select
                        value=""
                        onChange={(e) => handleAddProject(m.id, e.target.value)}
                        className="input-premium !py-0.5 !px-1.5 text-[11px] text-secondary"
                      >
                        <option value="">+ projeto</option>
                        {projects
                          .filter((p) => !m.projects.find((pj) => pj.project_id === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </td>

                  {/* Telefone */}
                  <td className="px-3 py-2.5">
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
                        className="input-premium !py-1 !px-2 text-[12px] w-[130px]"
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
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => handleDeleteMember(m.id, m.display_name)}
                      className="text-[var(--text-tertiary)] transition hover:text-[var(--danger)]"
                      title="Remover membro"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
