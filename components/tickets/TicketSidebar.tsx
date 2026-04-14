'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Calendar, SlidersHorizontal, Zap, Pin } from 'lucide-react';
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

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [statusRes, serviceRes, memberRes, categoryRes, sprintRes] = await Promise.all([
          fetch('/api/options?type=statuses'),
          fetch('/api/options?type=services'),
          fetch('/api/options?type=members'),
          fetch('/api/options?type=categories'),
          fetch('/api/options?type=sprints'),
        ]);
        if (statusRes.ok) setStatuses(await statusRes.json());
        if (serviceRes.ok) setServices(await serviceRes.json());
        if (memberRes.ok) setMembers(await memberRes.json());
        if (categoryRes.ok) setCategories(await categoryRes.json());
        if (sprintRes.ok) setSprints(await sprintRes.json());
      } catch (err) { console.error('Erro ao carregar opções:', err); }
    }
    fetchOptions();
  }, []);

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

    return (
      <div className="flex items-center justify-between py-2.5">
        <span className="text-[13px] text-slate-500">{label}</span>
        {fieldName && options && isEditing ? (
          <select
            autoFocus
            value={currentValue || ''}
            onChange={(e) => handleSelect(fieldName, e.target.value)}
            onBlur={() => setEditingField(null)}
            className="max-w-[180px] rounded border border-blue-500/30 bg-[#1e2126] px-2 py-1 text-[13px] text-slate-200 outline-none"
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
            className="rounded border border-blue-500/30 bg-[#1e2126] px-3 py-1.5 text-[13px] text-slate-200 outline-none"
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
        <button className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300">
          <Pin size={14} />
        </button>
      </div>

      {/* Informações */}
      <div className="rounded-lg border border-white/[0.06] bg-[#1e2126]">
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-1.5">
            {infoOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            <span className="text-[13px] font-semibold text-slate-200">Informações</span>
          </div>
          <SlidersHorizontal size={14} className="text-slate-500" />
        </button>

        {infoOpen && (
          <div className="border-t border-white/[0.04] px-4 pb-3">
            {/* Data limite */}
            <InfoRow label="Data limite" fieldName="due_date">
              {editingField === 'due_date' ? (
                <input
                  type="date"
                  autoFocus
                  defaultValue={ticket.due_date || ''}
                  onChange={(e) => handleSelect('due_date', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  className="rounded border border-blue-500/30 bg-[#1e2126] px-2 py-0.5 text-[13px] text-slate-200 outline-none"
                />
              ) : (
                <span className="flex items-center gap-1.5 text-slate-200" onClick={() => setEditingField('due_date')}>
                  <Calendar size={13} className="text-slate-500" />
                  {ticket.due_date || <span className="text-slate-600">Nenhum</span>}
                </span>
              )}
            </InfoRow>

            {/* Responsável */}
            <InfoRow label="Responsável" fieldName="assignee_id" options={members} currentValue={ticket.assignee_id} displayKey="display_name">
              {ticket.assignee_name ? (
                <span className="flex items-center gap-2 text-slate-200">
                  <Avatar name={ticket.assignee_name} size="xs" />
                  {ticket.assignee_name}
                </span>
              ) : (
                <span className="text-slate-600">Não atribuído</span>
              )}
            </InfoRow>

            {/* BAH! Serviço/Produto */}
            <InfoRow label="BAH! Serviço/Produto" fieldName="service_id" options={services} currentValue={ticket.service_id}>
              {ticket.service_name ? (
                <span className="rounded border border-white/[0.1] px-2 py-0.5 text-[12px] font-medium text-slate-200">
                  {ticket.service_name}
                </span>
              ) : (
                <span className="text-slate-600">Nenhum</span>
              )}
            </InfoRow>

            {/* Pai */}
            <InfoRow label="Pai">
              {ticket.parent_key ? (
                <Link href={`/ticket/${ticket.parent_id}`} className="flex items-center gap-1.5 text-green-400 hover:text-green-300">
                  <Zap size={13} />
                  <span className="rounded border border-green-500/20 px-1.5 py-0.5 text-[12px]">
                    {ticket.parent_key} {ticket.parent_title}
                  </span>
                </Link>
              ) : (
                <span className="text-slate-600">Nenhum</span>
              )}
            </InfoRow>

            {/* Categorias */}
            <InfoRow label="Categorias" fieldName="category_id" options={categories} currentValue={ticket.category_id}>
              {ticket.category_name ? (
                <span className="rounded border border-white/[0.1] px-2 py-0.5 text-[12px] font-medium text-slate-200">
                  {ticket.category_name}
                </span>
              ) : (
                <span className="text-slate-600">Nenhum</span>
              )}
            </InfoRow>

            {/* Sprint */}
            <InfoRow label="Sprint" fieldName="sprint_id" options={sprints} currentValue={ticket.sprint_id}>
              {ticket.sprint_name ? (
                <span className="text-blue-400">{ticket.sprint_name}</span>
              ) : (
                <span className="text-slate-600">Nenhum</span>
              )}
            </InfoRow>

            {/* Relator */}
            <InfoRow label="Relator" fieldName="reporter_id" options={members} currentValue={ticket.reporter_id} displayKey="display_name">
              {ticket.reporter_name ? (
                <span className="flex items-center gap-2 text-slate-200">
                  <Avatar name={ticket.reporter_name} size="xs" />
                  {ticket.reporter_name}
                </span>
              ) : (
                <span className="text-slate-600">Não atribuído</span>
              )}
            </InfoRow>
          </div>
        )}
      </div>

      {/* Collapsible sections */}
      <CollapsibleSection title="Desenvolvimento" defaultOpen={false} />
      <CollapsibleSection title="Automação" subtitle="Execuções de regras" icon="⚡" defaultOpen={false} />
    </div>
  );
}

function CollapsibleSection({ title, subtitle, icon, defaultOpen = false }: {
  title: string;
  subtitle?: string;
  icon?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-2 rounded-lg border border-white/[0.06] bg-[#1e2126]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3"
      >
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        {icon && <span className="text-[13px]">{icon}</span>}
        <span className="text-[13px] font-semibold text-slate-200">{title}</span>
        {subtitle && <span className="text-[11px] text-slate-500">{subtitle}</span>}
      </button>
      {open && (
        <div className="border-t border-white/[0.04] px-4 py-3 text-[12px] text-slate-500">
          Nenhum dado disponível
        </div>
      )}
    </div>
  );
}

function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={href} className={className}>{children}</a>;
}
