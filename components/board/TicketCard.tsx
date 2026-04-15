'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils/cn';
import { Calendar, Check } from 'lucide-react';
import { useBoardShell } from './BoardShell';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';

const priorityConfig: Record<string, { dot: string; border: string; label: string }> = {
  urgent: { dot: 'bg-red-500 shadow-red-500/40 shadow-sm', border: 'border-l-red-500', label: 'Urgente' },
  high: { dot: 'bg-orange-400 shadow-orange-400/30 shadow-sm', border: 'border-l-orange-400', label: 'Alta' },
  medium: { dot: 'bg-blue-400', border: 'border-l-blue-400', label: 'Média' },
  low: { dot: 'bg-slate-500', border: 'border-l-slate-600', label: 'Baixa' }
};

function getServiceInlineStyle(color: string | null): { bg: string; text: string } {
  if (!color) return { bg: 'rgba(100,116,139,0.08)', text: '#94a3b8' };
  return { bg: color + '14', text: color };
}

function nameToColor(name: string): string {
  const colors = [
    'from-blue-600 to-blue-500', 'from-violet-600 to-purple-500',
    'from-emerald-600 to-green-500', 'from-amber-600 to-orange-500',
    'from-rose-600 to-pink-500', 'from-cyan-600 to-teal-500',
    'from-indigo-600 to-blue-500', 'from-fuchsia-600 to-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface TicketCardProps {
  id: string;
  title: string;
  service: string;
  serviceColor?: string | null;
  due: string;
  assignee: string;
  priority: string;
  ticketKey: string;
  typeIcon: string;
  typeName?: string;
  categoryName?: string;
  completedAt?: string | null;
  clientName?: string | null;
  assigneeAvatar?: string | null;
  active: boolean;
  onClick: () => void;
}

export default function TicketCard({ id, title, service, serviceColor, due, assignee, priority, ticketKey, typeIcon, typeName, categoryName, completedAt, clientName, assigneeAvatar, active, onClick }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { openTicket } = useBoardShell();

  const prio = priorityConfig[priority] || priorityConfig.medium;
  const hasAssignee = assignee && assignee !== 'Sem responsável';
  const initials = hasAssignee
    ? assignee.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : null;
  const hasService = service && service !== 'Sem serviço';
  const hasDue = due && due !== '-';
  const svc = hasService ? getServiceInlineStyle(serviceColor ?? null) : null;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) openTicket(id); }}
      className={cn(
        'group cursor-pointer rounded-lg border border-white/[0.06] bg-[#232730] transition-all duration-150',
        'shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_6px_rgba(0,0,0,0.15)]',
        'hover:shadow-[0_4px_12px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.2)]',
        'hover:border-white/[0.12] hover:bg-[#282d37] hover:-translate-y-[1px]',
        'border-l-[3px]',
        prio.border,
        isDragging && 'opacity-30 rotate-2 scale-105',
        active && 'ring-2 ring-blue-500/30 border-blue-500/20'
      )}
    >
      <div className="px-3 py-3">
        {/* Row 1: Type + Key + Priority */}
        <div className="mb-2 flex items-center gap-1.5">
          <TicketTypeIcon typeIcon={typeIcon} size="sm" showBackground={false} />
          <span className="font-mono text-[10px] font-medium text-slate-500">{ticketKey}</span>
          <span className="flex-1" />
          <div className={cn('h-[7px] w-[7px] rounded-full', prio.dot)} title={prio.label} />
        </div>

        {/* Title */}
        <h3 className="mb-2.5 text-[13px] font-medium leading-[1.4] text-[#cdd0d5] line-clamp-2 group-hover:text-white transition-colors">
          {title}
        </h3>

        {/* Tags row: client, type, category, service */}
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          {clientName && (
            <span className="rounded-md px-1.5 py-[2px] text-[10px] font-medium bg-amber-500/10 text-amber-400 truncate max-w-[100px]" title={clientName}>
              {clientName}
            </span>
          )}
          {typeName && (
            <span className="rounded-md px-1.5 py-[2px] text-[10px] font-semibold bg-indigo-500/15 text-indigo-400">
              {typeName}
            </span>
          )}
          {categoryName && (
            <span className="rounded-md px-1.5 py-[2px] text-[10px] font-medium bg-white/[0.06] text-slate-400">
              {categoryName}
            </span>
          )}
          {hasService && svc && (
            <span
              className="rounded-md px-1.5 py-[2px] text-[10px] font-semibold"
              style={{ backgroundColor: svc.bg, color: svc.text }}
            >
              {service}
            </span>
          )}
        </div>

        {/* Footer: date + assignee */}
        <div className="flex items-center gap-1.5">
          {completedAt ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500">
              <Check size={10} strokeWidth={2} />
              {completedAt}
            </span>
          ) : hasDue ? (
            <span className="flex items-center gap-1 text-[10px] text-slate-600">
              <Calendar size={10} strokeWidth={1.5} />
              {due}
            </span>
          ) : null}
          <span className="flex-1" />
          {hasAssignee && (
            assigneeAvatar ? (
              <img
                src={assigneeAvatar}
                alt={assignee}
                title={assignee}
                className="h-6 w-6 rounded-full ring-2 ring-[#232730] object-cover"
              />
            ) : initials ? (
              <div
                className={cn('flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-bold text-white ring-2 ring-[#232730]', nameToColor(assignee))}
                title={assignee}
              >
                {initials}
              </div>
            ) : null
          )}
        </div>
      </div>
    </article>
  );
}
