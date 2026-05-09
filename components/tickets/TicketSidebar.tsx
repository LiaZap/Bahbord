'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Calendar, SlidersHorizontal, Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import Avatar from '@/components/ui/Avatar';

interface FieldOption {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  display_name?: string;
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
  const [editingField, setEditingField] = useState<string | null>(null);
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
    await onUpdate(field, value || null);
  }

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

            {/* Responsável */}
            <InfoRow label="Responsável" fieldName="assignee_id" options={members} currentValue={ticket.assignee_id} displayKey="display_name">
              {ticket.assignee_name ? (
                <span className="flex items-center gap-2 text-primary">
                  <Avatar name={ticket.assignee_name} size="xs" />
                  {ticket.assignee_name}
                </span>
              ) : (
                <span className="text-tertiary-muted">Não atribuído</span>
              )}
            </InfoRow>

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

    </div>
  );
}

