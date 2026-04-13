'use client';

import { useState, useEffect } from 'react';
import { Calendar, User, Tag, Flag, Layers, GitBranch, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface FieldOption {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  display_name?: string;
  avatar_url?: string;
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
  };
  onUpdate: (field: string, value: unknown) => Promise<void>;
}

export default function TicketSidebar({ ticket, onUpdate }: TicketSidebarProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<FieldOption[]>([]);
  const [services, setServices] = useState<FieldOption[]>([]);
  const [members, setMembers] = useState<FieldOption[]>([]);
  const [categories, setCategories] = useState<FieldOption[]>([]);
  const [sprints, setSprints] = useState<FieldOption[]>([]);
  const [ticketTypes, setTicketTypes] = useState<FieldOption[]>([]);

  useEffect(() => {
    // Buscar opções para os selects
    async function fetchOptions() {
      try {
        const [statusRes, serviceRes, memberRes, categoryRes, sprintRes, typeRes] = await Promise.all([
          fetch('/api/options?type=statuses'),
          fetch('/api/options?type=services'),
          fetch('/api/options?type=members'),
          fetch('/api/options?type=categories'),
          fetch('/api/options?type=sprints'),
          fetch('/api/options?type=ticket_types'),
        ]);

        if (statusRes.ok) setStatuses(await statusRes.json());
        if (serviceRes.ok) setServices(await serviceRes.json());
        if (memberRes.ok) setMembers(await memberRes.json());
        if (categoryRes.ok) setCategories(await categoryRes.json());
        if (sprintRes.ok) setSprints(await sprintRes.json());
        if (typeRes.ok) setTicketTypes(await typeRes.json());
      } catch { /* silencioso */ }
    }
    fetchOptions();
  }, []);

  const prio = priorityOptions.find((p) => p.id === ticket.priority) || priorityOptions[2];

  async function handleSelect(field: string, value: string) {
    setEditingField(null);
    await onUpdate(field, value || null);
  }

  function renderField(
    icon: React.ElementType,
    label: string,
    fieldName: string,
    currentValue: string | null,
    displayValue: React.ReactNode,
    options: FieldOption[],
    valueKey: string = 'id',
    displayKey: string = 'name'
  ) {
    const Icon = icon;
    const isEditing = editingField === fieldName;

    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Icon size={12} />
          {label}
        </span>
        {isEditing ? (
          <select
            autoFocus
            value={currentValue || ''}
            onChange={(e) => handleSelect(fieldName, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="max-w-[160px] rounded border border-accent/40 bg-surface px-1.5 py-0.5 text-xs text-slate-200 outline-none"
          >
            <option value="">Nenhum</option>
            {options.map((opt) => (
              <option key={opt[valueKey as keyof FieldOption] as string} value={opt[valueKey as keyof FieldOption] as string}>
                {opt.icon ? `${opt.icon} ` : ''}{opt[displayKey as keyof FieldOption] as string}
              </option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setEditingField(fieldName)}
            className="max-w-[160px] truncate text-right text-xs text-slate-300 transition hover:text-accent"
          >
            {displayValue || <span className="text-slate-600">Nenhum</span>}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Status */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</h3>
        {editingField === 'status_id' ? (
          <select
            autoFocus
            value={ticket.status_id || ''}
            onChange={(e) => handleSelect('status_id', e.target.value)}
            onBlur={() => setEditingField(null)}
            className="w-full rounded border border-accent/40 bg-surface px-2 py-1 text-xs text-slate-200 outline-none"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setEditingField('status_id')}
            className="rounded px-2 py-1 text-xs font-semibold transition hover:opacity-80"
            style={{ backgroundColor: ticket.status_color + '20', color: ticket.status_color }}
          >
            {ticket.status_name}
          </button>
        )}
      </div>

      {/* Detalhes */}
      <div className="rounded-lg border border-border/40 bg-surface2 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Detalhes</h3>
        <div className="space-y-3 text-sm">
          {/* Prioridade */}
          {renderField(Flag, 'Prioridade', 'priority', ticket.priority,
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: prio.color }} />
              {prio.name}
            </span>,
            priorityOptions
          )}

          {/* Responsável */}
          {renderField(User, 'Responsável', 'assignee_id', ticket.assignee_id,
            ticket.assignee_name,
            members, 'id', 'display_name'
          )}

          {/* Relator */}
          {renderField(User, 'Relator', 'reporter_id', ticket.reporter_id,
            ticket.reporter_name,
            members, 'id', 'display_name'
          )}

          {/* Serviço/Produto */}
          {renderField(Tag, 'Serviço', 'service_id', ticket.service_id,
            ticket.service_name ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: (ticket.service_color || '#666') + '20', color: ticket.service_color || '#666' }}>
                {ticket.service_name}
              </span>
            ) : null,
            services
          )}

          {/* Tipo */}
          {renderField(Layers, 'Tipo', 'ticket_type_id', ticket.ticket_type_id,
            <span className="flex items-center gap-1">{ticket.type_icon} {ticket.type_name}</span>,
            ticketTypes
          )}

          {/* Categoria */}
          {renderField(Tag, 'Categoria', 'category_id', ticket.category_id,
            ticket.category_name,
            categories
          )}

          {/* Sprint */}
          {renderField(GitBranch, 'Sprint', 'sprint_id', ticket.sprint_id,
            ticket.sprint_name,
            sprints
          )}

          {/* Data limite */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar size={12} />
              Data limite
            </span>
            {editingField === 'due_date' ? (
              <input
                type="date"
                autoFocus
                defaultValue={ticket.due_date || ''}
                onChange={(e) => handleSelect('due_date', e.target.value)}
                onBlur={() => setEditingField(null)}
                className="rounded border border-accent/40 bg-surface px-1.5 py-0.5 text-xs text-slate-200 outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingField('due_date')}
                className="text-xs text-slate-300 transition hover:text-accent"
              >
                {ticket.due_date || <span className="text-slate-600">Sem prazo</span>}
              </button>
            )}
          </div>

          {/* Pai */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Layers size={12} />
              Pai
            </span>
            <span className="text-xs text-slate-300">
              {ticket.parent_key ? (
                <a href={`/ticket/${ticket.parent_id}`} className="font-mono text-accent hover:underline">
                  {ticket.parent_key}
                </a>
              ) : (
                <span className="text-slate-600">Nenhum</span>
              )}
            </span>
          </div>

          {/* Datas fixas */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={12} />
              Criado em
            </span>
            <span className="text-xs text-slate-300">{ticket.created_at}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={12} />
              Atualizado
            </span>
            <span className="text-xs text-slate-300">{ticket.updated_at}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
