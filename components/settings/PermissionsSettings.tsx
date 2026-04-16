'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Shield, X, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AnimatePresence, motion } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PermissionGroup {
  id: string;
  name: string;
  permission_count: number;
}

interface Permission {
  id: string;
  key: string;
  display_name: string;
  group_id: string | null;
  group_name: string | null;
  scope: 'users' | 'api_keys' | 'both';
  created_at: string;
}

interface RolePermission {
  id: string;
  role_name: string;
  permission_id: string;
  key: string;
  display_name: string;
  scope: string;
  group_name: string | null;
}

type Tab = 'catalog' | 'roles';
type ModalMode = 'create' | 'edit';

const SCOPE_LABELS: Record<string, { label: string; className: string }> = {
  users: { label: 'Usuário', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  api_keys: { label: 'API', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  both: { label: 'Ambos', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const ROLES = [
  { key: 'owner', label: 'Owner', description: 'Acesso total ao workspace' },
  { key: 'admin', label: 'Admin', description: 'Gerenciar configurações e membros' },
  { key: 'member', label: 'Membro', description: 'Acesso padrão de trabalho' },
  { key: 'viewer', label: 'Visualizador', description: 'Somente leitura' },
];

/* ------------------------------------------------------------------ */
/*  Scope Badge                                                        */
/* ------------------------------------------------------------------ */

function ScopeBadge({ scope, permKey }: { scope: string; permKey?: string }) {
  if (permKey === 'admin:all') {
    return (
      <span className="inline-flex items-center rounded border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400">
        Admin
      </span>
    );
  }
  const info = SCOPE_LABELS[scope] || SCOPE_LABELS.both;
  return (
    <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium', info.className)}>
      {info.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function PermissionsSettings() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formGroupId, setFormGroupId] = useState<string>('');
  const [formScope, setFormScope] = useState<'users' | 'api_keys' | 'both'>('both');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [saving, setSaving] = useState(false);

  // Roles tab state
  const [selectedRole, setSelectedRole] = useState('admin');
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loadingRole, setLoadingRole] = useState(false);

  /* ---- Fetch data ---- */

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions');
      if (res.ok) setPermissions(await res.json());
    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/permission-groups');
      if (res.ok) setGroups(await res.json());
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
    }
  }, []);

  const fetchRolePermissions = useCallback(async (role: string) => {
    setLoadingRole(true);
    try {
      const res = await fetch(`/api/role-permissions?role=${role}`);
      if (res.ok) setRolePermissions(await res.json());
    } catch (err) {
      console.error('Erro ao carregar permissões do cargo:', err);
    } finally {
      setLoadingRole(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPermissions(), fetchGroups()]).finally(() => setLoading(false));
  }, [fetchPermissions, fetchGroups]);

  useEffect(() => {
    if (tab === 'roles') fetchRolePermissions(selectedRole);
  }, [tab, selectedRole, fetchRolePermissions]);

  /* ---- Group permissions by group_name ---- */

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const g = p.group_name || 'Sem grupo';
    if (!acc[g]) acc[g] = [];
    acc[g].push(p);
    return acc;
  }, {});

  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    if (a === 'Sem grupo') return 1;
    if (b === 'Sem grupo') return -1;
    return a.localeCompare(b);
  });

  /* ---- Modal handlers ---- */

  function openCreateModal() {
    setModalMode('create');
    setEditingPermission(null);
    setFormKey('');
    setFormDisplayName('');
    setFormGroupId('');
    setFormScope('both');
    setCreatingGroup(false);
    setNewGroupName('');
    setModalOpen(true);
  }

  function openEditModal(perm: Permission) {
    setModalMode('edit');
    setEditingPermission(perm);
    setFormKey(perm.key);
    setFormDisplayName(perm.display_name);
    setFormGroupId(perm.group_id || '');
    setFormScope(perm.scope);
    setCreatingGroup(false);
    setNewGroupName('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formKey.trim() || !formDisplayName.trim()) return;
    setSaving(true);

    try {
      let groupId = formGroupId;

      // Create new group if needed
      if (creatingGroup && newGroupName.trim()) {
        const res = await fetch('/api/permission-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newGroupName.trim() }),
        });
        if (res.ok) {
          const newGroup = await res.json();
          groupId = newGroup.id;
        }
      }

      if (modalMode === 'create') {
        await fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: formKey.trim(),
            display_name: formDisplayName.trim(),
            group_id: groupId || null,
            scope: formScope,
          }),
        });
      } else if (editingPermission) {
        await fetch('/api/permissions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPermission.id,
            display_name: formDisplayName.trim(),
            group_id: groupId || null,
            scope: formScope,
          }),
        });
      }

      setModalOpen(false);
      await Promise.all([fetchPermissions(), fetchGroups()]);
    } catch (err) {
      console.error('Erro ao salvar permissão:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta permissão? Isso também remove as atribuições de cargo vinculadas.')) return;
    try {
      await fetch(`/api/permissions?id=${id}`, { method: 'DELETE' });
      await Promise.all([fetchPermissions(), fetchGroups()]);
    } catch (err) {
      console.error('Erro ao remover permissão:', err);
    }
  }

  /* ---- Role permission toggle ---- */

  async function toggleRolePermission(permissionId: string) {
    const existing = rolePermissions.find((rp) => rp.permission_id === permissionId);

    if (existing) {
      await fetch(`/api/role-permissions?id=${existing.id}`, { method: 'DELETE' });
    } else {
      await fetch('/api/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_name: selectedRole, permission_id: permissionId }),
      });
    }

    await fetchRolePermissions(selectedRole);
  }

  /* ---- Loading ---- */

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  /* ---- Render ---- */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Permissões</h2>
        {tab === 'catalog' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
          >
            <Plus size={14} />
            Nova Permissão
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface2 p-1">
        <button
          onClick={() => setTab('catalog')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition',
            tab === 'catalog'
              ? 'bg-[var(--modal-bg)] text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          Catálogo de Permissões
        </button>
        <button
          onClick={() => setTab('roles')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition',
            tab === 'roles'
              ? 'bg-[var(--modal-bg)] text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          Cargos
        </button>
      </div>

      {/* ============ CATALOG TAB ============ */}
      {tab === 'catalog' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Catálogo de permissões do sistema. Cada permissão define uma ação que pode ser atribuída a cargos.
          </p>

          {sortedGroups.map((groupName) => (
            <div key={groupName}>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {groupName}
              </div>
              <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-surface2/50">
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Chave
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Nome de Exibição
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Escopo
                      </th>
                      <th className="w-20 px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[groupName].map((perm) => (
                      <tr
                        key={perm.id}
                        className="border-b border-white/[0.04] transition last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5">
                          <code className="font-mono text-[12px] text-blue-400">{perm.key}</code>
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-slate-300">{perm.display_name}</td>
                        <td className="px-4 py-2.5">
                          <ScopeBadge scope={perm.scope} permKey={perm.key} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(perm)}
                              className="rounded p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(perm.id)}
                              className="rounded p-1 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {permissions.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.08] py-12">
              <Shield size={32} className="mb-3 text-slate-600" />
              <p className="text-sm text-slate-500">Nenhuma permissão cadastrada</p>
              <button
                onClick={openCreateModal}
                className="mt-3 flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
              >
                <Plus size={14} />
                Criar primeira permissão
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ ROLES TAB ============ */}
      {tab === 'roles' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Selecione um cargo para gerenciar suas permissões. Marque ou desmarque as permissões para cada cargo.
          </p>

          {/* Role selector */}
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedRole(r.key)}
                className={cn(
                  'rounded-lg border px-4 py-2.5 text-left transition',
                  selectedRole === r.key
                    ? 'border-accent/40 bg-accent/10'
                    : 'border-white/[0.06] bg-surface2 hover:border-white/[0.12]'
                )}
              >
                <div className={cn('text-[13px] font-medium', selectedRole === r.key ? 'text-accent' : 'text-slate-300')}>
                  {r.label}
                </div>
                <div className="text-[11px] text-slate-500">{r.description}</div>
              </button>
            ))}
          </div>

          {/* Permission checklist */}
          {loadingRole ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {sortedGroups.map((groupName) => (
                <div key={groupName}>
                  <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {groupName}
                  </div>
                  <div className="space-y-1">
                    {grouped[groupName].map((perm) => {
                      const assigned = rolePermissions.some((rp) => rp.permission_id === perm.id);
                      return (
                        <label
                          key={perm.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.04] px-4 py-2.5 transition hover:bg-white/[0.02]"
                        >
                          <div
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                              assigned
                                ? 'border-accent bg-accent'
                                : 'border-white/20 bg-transparent'
                            )}
                            onClick={() => toggleRolePermission(perm.id)}
                          >
                            {assigned && <Check size={10} className="text-white" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-[12px] text-blue-400">{perm.key}</code>
                              <ScopeBadge scope={perm.scope} permKey={perm.key} />
                            </div>
                            <div className="text-[12px] text-slate-400">{perm.display_name}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ MODAL ============ */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => setModalOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[var(--modal-bg)] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header */}
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">
                    {modalMode === 'create' ? 'Nova Permissão' : 'Editar Permissão'}
                  </h3>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="rounded p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Key */}
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-slate-400">
                      Chave do Sistema
                    </label>
                    <input
                      value={formKey}
                      onChange={(e) => setFormKey(e.target.value)}
                      placeholder="Ex: read:receivables"
                      disabled={modalMode === 'edit'}
                      className={cn(
                        'w-full rounded-lg border border-white/[0.08] bg-surface px-3 py-2 font-mono text-[13px] text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-accent/40',
                        modalMode === 'edit' && 'cursor-not-allowed opacity-50'
                      )}
                    />
                    <p className="mt-1 text-[11px] text-slate-600">
                      Formato: ação:recurso (ex: create:plans)
                    </p>
                  </div>

                  {/* Display name */}
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-slate-400">
                      Nome de Exibição
                    </label>
                    <input
                      value={formDisplayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      placeholder="Ex: Exibir Recebíveis"
                      className="w-full rounded-lg border border-white/[0.08] bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-accent/40"
                    />
                  </div>

                  {/* Group */}
                  <div>
                    <label className="mb-1 block text-[12px] font-medium text-slate-400">
                      Grupo / Categoria
                    </label>
                    {!creatingGroup ? (
                      <div className="relative">
                        <select
                          value={formGroupId}
                          onChange={(e) => {
                            if (e.target.value === '__new__') {
                              setCreatingGroup(true);
                              setFormGroupId('');
                            } else {
                              setFormGroupId(e.target.value);
                            }
                          }}
                          className="w-full appearance-none rounded-lg border border-white/[0.08] bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none transition focus:border-accent/40"
                        >
                          <option value="">Sem grupo</option>
                          <option value="__new__" className="text-accent">
                            + Criar novo grupo
                          </option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.permission_count})
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="Nome do novo grupo"
                          className="flex-1 rounded-lg border border-accent/30 bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none transition focus:border-accent/40"
                        />
                        <button
                          onClick={() => {
                            setCreatingGroup(false);
                            setNewGroupName('');
                          }}
                          className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 transition hover:text-slate-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scope */}
                  <div>
                    <label className="mb-2 block text-[12px] font-medium text-slate-400">
                      Escopo de Visibilidade
                    </label>
                    <div className="flex gap-3">
                      {[
                        { value: 'users' as const, label: 'Usuários (ERP)' },
                        { value: 'api_keys' as const, label: 'API Keys (M2M)' },
                        { value: 'both' as const, label: 'Ambos' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setFormScope(opt.value)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] transition',
                            formScope === opt.value
                              ? 'border-accent/40 bg-accent/10 text-white'
                              : 'border-white/[0.08] text-slate-400 hover:border-white/[0.15]'
                          )}
                        >
                          <div
                            className={cn(
                              'h-3 w-3 rounded-full border-2 transition',
                              formScope === opt.value
                                ? 'border-accent bg-accent'
                                : 'border-slate-500'
                            )}
                          />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal footer */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-slate-400 transition hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formKey.trim() || !formDisplayName.trim()}
                    className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : modalMode === 'create' ? 'Cadastrar Permissão' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
