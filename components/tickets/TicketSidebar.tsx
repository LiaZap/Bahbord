'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight, Calendar, SlidersHorizontal, Lock, Plus, Star, X, MoreVertical, Search, Moon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import SnoozeMenu from '@/components/tickets/SnoozeMenu';
import TicketDependencies from '@/components/tickets/TicketDependencies';

interface FieldOption {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  display_name?: string;
  avatar_url?: string | null;
  is_done?: boolean;
}

interface AssigneeRow {
  member_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  is_primary: boolean;
  added_at: string;
}

const priorityOptions = [
  { id: 'urgent', name: 'Urgente', color: '#ef4444' },
  { id: 'high', name: 'Alta', color: '#f97316' },
  { id: 'medium', name: 'Média', color: '#eab308' },
  { id: 'low', name: 'Baixa', color: '#60a5fa' },
];

interface TicketSidebarProps {
  ticket: {
    id: string;
    priority: string;
    assignee_name: string | null;
    assignee_id: string | null;
    reporter_name: string | null;
    reporter_id: string | null;
    service_name: string | null;
    service_id: string | null;
    service_color: string | null;
    category_name: string | null;
    category_id: string | null;
    sprint_name: string | null;
    sprint_id: string | null;
    type_name: string;
    type_icon: string;
    ticket_type_id: string;
    due_date: string | null;
    snoozed_until?: string | null;
    created_at: string;
    updated_at: string;
    status_name: string;
    status_id: string;
    status_color: string;
    parent_key: string | null;
    parent_id: string | null;
    parent_title: string | null;
    client_id: string | null;
    client_name: string | null;
    client_color: string | null;
    board_id: string | null;
    project_id: string | null;
  };
  onUpdate: (field: string, value: unknown) => Promise<void>;
}

export default function TicketSidebar({ ticket, onUpdate }: TicketSidebarProps) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(ticket.snoozed_until ?? null);

  // Sync local state quando ticket muda (após refetch externo)
  useEffect(() => {
    setSnoozedUntil(ticket.snoozed_until ?? null);
  }, [ticket.snoozed_until]);
  const [infoOpen, setInfoOpen] = useState(true);
  const [statuses, setStatuses] = useState<FieldOption[]>([]);
  const [services, setServices] = useState<FieldOption[]>([]);
  const [members, setMembers] = useState<FieldOption[]>([]);
  const [categories, setCategories] = useState<FieldOption[]>([]);
  const [sprints, setSprints] = useState<FieldOption[]>([]);
  const [clients, setClients] = useState<FieldOption[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  // Multi-assignees state
  const [assignees, setAssignees] = useState<AssigneeRow[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Bah!Company é o projeto "interno" — nele os campos service/client ficam editáveis
  const isBahCompany = projectName === 'Bah!Company';
  // Fields that only admins can edit (em projetos externos, service e client são travados)
  const adminOnlyFields = ['category_id', 'sprint_id', 'reporter_id'];

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [statusRes, serviceRes, memberRes, categoryRes, sprintRes, clientRes] = await Promise.all([
          fetch('/api/options?type=statuses'),
          fetch('/api/options?type=services'),
          fetch('/api/options?type=members'),
          fetch('/api/options?type=categories'),
          fetch(ticket.project_id ? `/api/options?type=sprints&project_id=${ticket.project_id}` : '/api/options?type=sprints'),
          fetch('/api/options?type=clients'),
        ]);
        if (statusRes.ok) setStatuses(await statusRes.json());
        if (serviceRes.ok) setServices(await serviceRes.json());
        if (memberRes.ok) {
          const allMembers = await memberRes.json();
          // Filter members by board/project access if ticket has board_id
          if (ticket.board_id || ticket.project_id) {
            try {
              const accessRes = await fetch(
                `/api/members/by-access?${ticket.board_id ? `board_id=${ticket.board_id}` : `project_id=${ticket.project_id}`}`
              );
              if (accessRes.ok) {
                const accessMembers = await accessRes.json();
                setMembers(accessMembers);
              } else {
                setMembers(allMembers);
              }
            } catch {
              setMembers(allMembers);
            }
          } else {
            setMembers(allMembers);
          }
        }
        if (categoryRes.ok) setCategories(await categoryRes.json());
        if (sprintRes.ok) setSprints(await sprintRes.json());
        if (clientRes.ok) setClients(await clientRes.json());
        // Get user role
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const me = await meRes.json();
          setUserRole(me?.member?.role || null);
        }
        // Get project name to determine if it's internal (Bah!Company)
        if (ticket.project_id) {
          const projRes = await fetch('/api/options?type=projects');
          if (projRes.ok) {
            const projs = await projRes.json();
            const current = projs.find((p: any) => p.id === ticket.project_id);
            setProjectName(current?.name || null);
          }
        }
      } catch (err) { console.error('Erro ao carregar opções:', err); }
    }
    fetchOptions();
  }, [ticket.project_id, ticket.board_id]);

  async function handleSelect(field: string, value: string) {
    setEditingField(null);
    // Antes de mover pra status concluído, verificar se há bloqueadores ainda abertos.
    if (field === 'status_id' && value) {
      const target = statuses.find((s) => s.id === value);
      if (target?.is_done) {
        const blockers = await fetchOpenBlockers();
        if (blockers.length > 0) {
          const list = blockers
            .slice(0, 3)
            .map((b) => `${b.ticket_key} (${b.title})`)
            .join(', ');
          const more = blockers.length > 3 ? ` e mais ${blockers.length - 3}` : '';
          const ok = await confirm({
            title: 'Ticket bloqueado',
            message: `Este ticket está bloqueado por: ${list}${more}. Concluir mesmo assim?`,
            confirmText: 'Concluir',
            cancelText: 'Cancelar',
            variant: 'warning',
          });
          if (!ok) return;
        }
      }
    }
    await onUpdate(field, value || null);
  }

  /** Busca relations do tipo blocked_by que ainda não estão done. */
  async function fetchOpenBlockers(): Promise<Array<{ ticket_key: string; title: string }>> {
    try {
      const res = await fetch(`/api/ticket-relations?ticket_id=${ticket.id}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter(
          (r: any) =>
            r.relation_type === 'blocked_by' && r.target_is_done !== true
        )
        .map((r: any) => ({
          ticket_key: r.target_ticket_key || '—',
          title: r.target_title || 'Sem título',
        }));
    } catch {
      return [];
    }
  }

  // ─────────── Multi-assignees ───────────
  async function loadAssignees() {
    setAssigneesLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assignees`);
      if (res.ok) {
        const data = (await res.json()) as AssigneeRow[];
        setAssignees(Array.isArray(data) ? data : []);
      }
    } catch {
      // silencioso
    } finally {
      setAssigneesLoading(false);
    }
  }

  useEffect(() => {
    loadAssignees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  // Fecha picker e menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setPickerSearch('');
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuFor(null);
      }
    }
    if (pickerOpen || openMenuFor) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [pickerOpen, openMenuFor]);

  async function addAssignee(memberId: string) {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data?.error || 'Erro ao adicionar responsável', 'error');
        return;
      }
      toast('Responsável adicionado', 'success');
      await loadAssignees();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  async function removeAssignee(memberId: string) {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assignees?member_id=${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data?.error || 'Erro ao remover responsável', 'error');
        return;
      }
      toast('Responsável removido', 'success');
      setOpenMenuFor(null);
      await loadAssignees();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  async function makePrimary(memberId: string) {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, is_primary: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data?.error || 'Erro ao definir como principal', 'error');
        return;
      }
      toast('Definido como principal', 'success');
      setOpenMenuFor(null);
      await loadAssignees();
    } catch {
      toast('Erro de conexão', 'error');
    }
  }

  const assigneeIds = useMemo(() => new Set(assignees.map((a) => a.member_id)), [assignees]);
  const filteredMembers = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const dn = (m.display_name || m.name || '').toLowerCase();
      return dn.includes(q);
    });
  }, [members, pickerSearch]);

  const prio = priorityOptions.find((p) => p.id === ticket.priority) || priorityOptions[2];


  function InfoRow({ label, children, fieldName, options, currentValue, displayKey }: {
    label: string;
    children: React.ReactNode;
    fieldName?: string;
    options?: FieldOption[];
    currentValue?: string | null;
    displayKey?: string;
  }) {
    const isEditing = editingField === fieldName;
    const isLocked = fieldName && adminOnlyFields.includes(fieldName) && !isAdmin;

    return (
      <div className="flex items-center justify-between py-2.5">
        <span className="text-[13px] text-secondary-muted flex items-center gap-1">
          {label}
          {isLocked && <Lock size={10} className="text-tertiary-muted" />}
        </span>
        {isLocked ? (
          <div className="max-w-[180px] text-right text-[13px]">{children}</div>
        ) : fieldName && options && isEditing ? (
          <select
            autoFocus
            value={currentValue || ''}
            onChange={(e) => handleSelect(fieldName, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="max-w-[180px] rounded border border-blue-500/30 bg-[var(--modal-bg)] px-2 py-1 text-[13px] text-primary outline-none"
          >
            <option value="">Nenhum</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.icon ? `${opt.icon} ` : ''}{(opt as any)[displayKey || 'name']}
              </option>
            ))}
          </select>
        ) : (
          <div
            onClick={() => fieldName && setEditingField(fieldName)}
            className={cn('max-w-[180px] text-right text-[13px]', fieldName && 'cursor-pointer hover:text-blue-400')}
          >
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Status dropdown */}
      <div className="mb-4 flex items-center gap-2">
        {editingField === 'status_id' ? (
          <select
            autoFocus
            value={ticket.status_id}
            onChange={(e) => handleSelect('status_id', e.target.value)}
            onBlur={() => setEditingField(null)}
            className="rounded border border-blue-500/30 bg-[var(--modal-bg)] px-3 py-1.5 text-[13px] text-primary outline-none"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setEditingField('status_id')}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition hover:opacity-80"
            style={{ backgroundColor: ticket.status_color + '25', color: ticket.status_color }}
          >
            {ticket.status_name}
            <ChevronDown size={13} />
          </button>
        )}
      </div>

      {/* Informações */}
      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--modal-bg)]">
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-1.5">
            {infoOpen ? <ChevronDown size={14} className="text-secondary-muted" /> : <ChevronRight size={14} className="text-secondary-muted" />}
            <span className="text-[13px] font-semibold text-primary">Informações</span>
          </div>
          <SlidersHorizontal size={14} className="text-secondary-muted" />
        </button>

        {infoOpen && (
          <div className="border-t border-[var(--card-border)] px-4 pb-3">
            {/* Data limite */}
            <InfoRow label="Data limite" fieldName="due_date">
              {editingField === 'due_date' ? (
                <input
                  type="date"
                  autoFocus
                  defaultValue={ticket.due_date ? ticket.due_date.substring(0, 10) : ''}
                  onChange={(e) => handleSelect('due_date', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  className="rounded border border-blue-500/30 bg-[var(--modal-bg)] px-2 py-0.5 text-[13px] text-primary outline-none"
                />
              ) : (
                <span className="flex items-center gap-1.5 text-primary" onClick={() => setEditingField('due_date')}>
                  <Calendar size={13} className="text-secondary-muted" />
                  {ticket.due_date
                    ? new Date(ticket.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : <span className="text-tertiary-muted">Nenhum</span>}
                </span>
              )}
            </InfoRow>

            {/* Snooze */}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[13px] text-secondary-muted">Snooze</span>
              <div className="flex max-w-[180px] items-center gap-2 text-right text-[13px]">
                {snoozedUntil && new Date(snoozedUntil).getTime() > Date.now() ? (
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <Moon size={12} />
                    {new Date(snoozedUntil).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                ) : (
                  <span className="text-tertiary-muted">Ativo</span>
                )}
                <SnoozeMenu
                  ticketId={ticket.id}
                  currentSnoozedUntil={snoozedUntil}
                  onChanged={(v) => setSnoozedUntil(v)}
                  compact
                />
              </div>
            </div>

            {/* Prioridade */}
            <InfoRow label="Prioridade" fieldName="priority">
              {editingField === 'priority' ? (
                <select
                  autoFocus
                  value={ticket.priority}
                  onChange={(e) => { handleSelect('priority', e.target.value); }}
                  onBlur={() => setEditingField(null)}
                  className="max-w-[180px] rounded border border-blue-500/30 bg-[var(--modal-bg)] px-2 py-1 text-[13px] text-primary outline-none"
                >
                  {priorityOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <span
                  className="flex cursor-pointer items-center gap-1.5 text-primary"
                  onClick={() => setEditingField('priority')}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prio.color }} />
                  {prio.name}
                </span>
              )}
            </InfoRow>

            {/* Responsáveis (multi) */}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[13px] text-secondary-muted">Responsáveis</span>
              <div className="relative flex items-center gap-1.5" ref={pickerRef}>
                {assignees.length === 0 ? (
                  <span className="text-[13px] text-tertiary-muted">Não atribuído</span>
                ) : (
                  <div className="flex items-center -space-x-1.5">
                    {assignees.slice(0, 3).map((a) => (
                      <div key={a.member_id} className="group relative">
                        <div
                          className={cn(
                            'rounded-full ring-2 ring-[var(--modal-bg)]',
                            a.is_primary && 'ring-[var(--accent)]'
                          )}
                          title={a.display_name + (a.is_primary ? ' (principal)' : '')}
                        >
                          <Avatar name={a.display_name} imageUrl={a.avatar_url} size="sm" />
                        </div>
                        {a.is_primary && (
                          <Star
                            size={9}
                            className="absolute -right-0.5 -top-0.5 fill-[var(--accent)] text-[var(--accent)]"
                          />
                        )}
                      </div>
                    ))}
                    {assignees.length > 3 && (
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--overlay-hover)] text-[10px] font-semibold text-secondary-muted ring-2 ring-[var(--modal-bg)]"
                        title={assignees.slice(3).map((a) => a.display_name).join(', ')}
                      >
                        +{assignees.length - 3}
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen((v) => !v);
                    setPickerSearch('');
                    setOpenMenuFor(null);
                  }}
                  disabled={assigneesLoading}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-[var(--card-border)] text-secondary-muted transition hover:border-[var(--accent)] hover:bg-[var(--overlay-hover)] hover:text-primary disabled:opacity-50"
                  aria-label="Adicionar responsável"
                  title="Adicionar responsável"
                >
                  <Plus size={12} />
                </button>

                {pickerOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-[var(--card-border)] bg-[var(--modal-bg)] shadow-lg">
                    <div className="flex items-center gap-1.5 border-b border-[var(--card-border)] px-2 py-1.5">
                      <Search size={12} className="text-tertiary-muted" />
                      <input
                        autoFocus
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Buscar membro..."
                        className="flex-1 bg-transparent text-[12px] text-primary outline-none placeholder:text-tertiary-muted"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {filteredMembers.length === 0 && (
                        <div className="px-3 py-2 text-[12px] text-tertiary-muted">Nenhum membro</div>
                      )}
                      {filteredMembers.map((m) => {
                        const id = m.id;
                        const dn = m.display_name || m.name;
                        const isSelected = assigneeIds.has(id);
                        const current = assignees.find((a) => a.member_id === id);
                        const isPrimary = current?.is_primary === true;
                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between px-2 py-1 hover:bg-[var(--overlay-hover)]"
                          >
                            <button
                              type="button"
                              onClick={() => (isSelected ? removeAssignee(id) : addAssignee(id))}
                              className="flex flex-1 items-center gap-2 text-left"
                            >
                              <span
                                className={cn(
                                  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                  isSelected
                                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                                    : 'border-[var(--card-border)] bg-transparent'
                                )}
                              >
                                {isSelected && <span className="text-[9px] leading-none text-white">✓</span>}
                              </span>
                              <Avatar name={dn} imageUrl={m.avatar_url} size="xs" />
                              <span className="truncate text-[12px] text-primary">{dn}</span>
                              {isPrimary && (
                                <Star size={10} className="shrink-0 fill-[var(--accent)] text-[var(--accent)]" />
                              )}
                            </button>
                            {isSelected && !isPrimary && (
                              <div className="relative" ref={openMenuFor === id ? menuRef : null}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuFor(openMenuFor === id ? null : id);
                                  }}
                                  className="ml-1 rounded p-1 text-tertiary-muted hover:bg-[var(--overlay-subtle)] hover:text-primary"
                                  aria-label="Mais ações"
                                >
                                  <MoreVertical size={12} />
                                </button>
                                {openMenuFor === id && (
                                  <div className="absolute right-0 top-full z-40 mt-0.5 w-44 rounded-md border border-[var(--card-border)] bg-[var(--modal-bg)] shadow-lg">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        makePrimary(id);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-primary hover:bg-[var(--overlay-hover)]"
                                    >
                                      <Star size={12} className="text-[var(--accent)]" />
                                      Tornar principal
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeAssignee(id);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-primary hover:bg-[var(--overlay-hover)]"
                                    >
                                      <X size={12} className="text-[var(--danger)]" />
                                      Remover
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BAH! Serviço/Produto - só no projeto interno Bah!Company */}
            {isBahCompany && (
              <InfoRow label="BAH! Serviço/Produto" fieldName="service_id" options={services} currentValue={ticket.service_id}>
                {ticket.service_name ? (
                  <span className="rounded border border-[var(--card-border)] px-2 py-0.5 text-[12px] font-medium text-primary">
                    {ticket.service_name}
                  </span>
                ) : (
                  <span className="text-tertiary-muted">Nenhum</span>
                )}
              </InfoRow>
            )}

            {/* Cliente - travado em projetos externos (não editável) */}
            <InfoRow
              label="Cliente"
              fieldName={isBahCompany ? 'client_id' : undefined}
              options={clients}
              currentValue={ticket.client_id}
            >
              {ticket.client_name ? (
                <span
                  className="rounded px-2 py-0.5 text-[12px] font-medium"
                  style={{ backgroundColor: (ticket.client_color || '#6366f1') + '20', color: ticket.client_color || '#6366f1' }}
                >
                  {ticket.client_name}
                </span>
              ) : (
                <span className="text-tertiary-muted">Nenhum</span>
              )}
            </InfoRow>

            {/* Categorias */}
            <InfoRow label="Categorias" fieldName="category_id" options={categories} currentValue={ticket.category_id}>
              {ticket.category_name ? (
                <span className="rounded border border-[var(--card-border)] px-2 py-0.5 text-[12px] font-medium text-primary">
                  {ticket.category_name}
                </span>
              ) : (
                <span className="text-tertiary-muted">Nenhum</span>
              )}
            </InfoRow>

            {/* Sprint */}
            <InfoRow label="Sprint" fieldName="sprint_id" options={sprints} currentValue={ticket.sprint_id}>
              {ticket.sprint_name ? (
                <span className="text-blue-400">{ticket.sprint_name}</span>
              ) : (
                <span className="text-tertiary-muted">Nenhum</span>
              )}
            </InfoRow>

            {/* Relator */}
            <InfoRow label="Relator" fieldName="reporter_id" options={members} currentValue={ticket.reporter_id} displayKey="display_name">
              {ticket.reporter_name ? (
                <span className="flex items-center gap-2 text-primary">
                  <Avatar name={ticket.reporter_name} size="xs" />
                  {ticket.reporter_name}
                </span>
              ) : (
                <span className="text-tertiary-muted">Não atribuído</span>
              )}
            </InfoRow>
          </div>
        )}
      </div>

      {/* Bloqueios / Dependências */}
      <div className="mt-4">
        <TicketDependencies ticketId={ticket.id} />
      </div>

    </div>
  );
}

