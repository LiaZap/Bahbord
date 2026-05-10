'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils/cn';
import { Calendar, Check, Clock, Edit, Copy, Link as LinkIcon, Trash2, User, Flag } from 'lucide-react';
import { useBoardShell } from './BoardShell';
import TicketTypeIcon from '@/components/ui/TicketTypeIcon';
import Tooltip from '@/components/ui/Tooltip';
import { ContextMenu } from '@/components/ui/ContextMenu';
import SnoozeMenu, { SnoozedBadge } from '@/components/tickets/SnoozeMenu';
import { getSlaStatus, formatSlaRemaining, slaColorClasses } from '@/lib/sla';

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
  snoozedUntil?: string | null;
  /** ISO timestamp do SLA (vem da view tickets_full.sla_due_at). */
  slaDueAt?: string | null;
  active: boolean;
  onClick: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export default function TicketCard({ id, title, service, serviceColor, due, assignee, priority, ticketKey, typeIcon, typeName, categoryName, completedAt, clientName, assigneeAvatar, snoozedUntil, slaDueAt, active, onClick, selected, onToggleSelect }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { openTicket } = useBoardShell();

  const prio = priorityConfig[priority] || priorityConfig.medium;
  // SLA badge: só renderiza pra warning/overdue (ok/none = silencioso pra não poluir).
  // `completedAt` no card já indica is_done — usamos como proxy.
  const slaStatus = getSlaStatus(slaDueAt, !!completedAt);
  const showSlaBadge = slaStatus === 'warning' || slaStatus === 'overdue';
  const slaColors = slaColorClasses(slaStatus);
  const slaText = showSlaBadge ? formatSlaRemaining(slaDueAt) : '';
  const hasAssignee = assignee && assignee !== 'Sem responsável';
  const initials = hasAssignee
    ? assignee.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : null;
  const hasService = service && service !== 'Sem serviço';
  const hasDue = due && due !== '-';
  const svc = hasService ? getServiceInlineStyle(serviceColor ?? null) : null;

  return (
    <ContextMenu
      items={[
        {
          label: 'Abrir ticket',
          icon: <Edit size={14} />,
          onSelect: () => openTicket(id),
        },
        {
          label: 'Copiar link',
          icon: <LinkIcon size={14} />,
          onSelect: () => {
            if (typeof window !== 'undefined') {
              navigator.clipboard.writeText(`${window.location.origin}/ticket/${id}`);
            }
          },
        },
        {
          label: 'Copiar key',
          icon: <Copy size={14} />,
          onSelect: () => {
            if (typeof navigator !== 'undefined') {
              navigator.clipboard.writeText(ticketKey);
            }
          },
        },
      ]}
    >
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        // Cmd/Ctrl/Shift+Click → toggle seleção (bulk mode)
        if ((e.metaKey || e.ctrlKey || e.shiftKey) && onToggleSelect) {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect();
          return;
        }
        openTicket(id);
      }}
      aria-label={ticketKey + ': ' + title}
      aria-selected={selected}
      role="button"
      className={cn(
        'card-premium group cursor-pointer',
        'hover:bg-[var(--card-hover)] hover:-translate-y-[1px]',
        'border-l-[3px]',
        prio.border,
        isDragging && 'opacity-30 rotate-2 scale-105',
        active && 'ring-2 ring-accent/30 border-accent/20',
        selected && 'ring-2 ring-[var(--accent)] border-[var(--accent)]'
      )}
    >
      <div className="px-3 py-3">
        {/* Row 1: Type + Key + Priority */}
        <div className="mb-2 flex items-center gap-1.5">
          <TicketTypeIcon typeIcon={typeIcon} size="sm" showBackground={false} />
          <span className="font-mono tabular-nums text-[11px] font-bold text-primary">{ticketKey}</span>
          <span className="flex-1" />
          <span className={cn('flex items-center gap-1 text-[10px] font-medium', priority === 'urgent' ? 'text-red-400' : priority === 'high' ? 'text-orange-400' : 'text-secondary-muted')}>
            <Tooltip content={`Prioridade: ${prio.label}`}>
              <span className={cn('h-[7px] w-[7px] rounded-full', prio.dot)} />
            </Tooltip>
            {(priority === 'urgent' || priority === 'high') && <span>{prio.label}</span>}
          </span>
          <span
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          >
            <SnoozeMenu
              ticketId={id}
              currentSnoozedUntil={snoozedUntil}
              compact
            />
          </span>
        </div>

        {/* Title */}
        <h3 className="mb-2.5 text-[13px] font-medium leading-[1.4] text-primary line-clamp-2 transition-colors">
          {title}
        </h3>

        {/* Tags row: SLA badge, snooze badge, client, type, category, service */}
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          {showSlaBadge && (
            <Tooltip content={`SLA: ${slaText}`}>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[10px] font-medium border',
                  slaColors.bg,
                  slaColors.text,
                  slaColors.border
                )}
              >
                <Clock size={9} strokeWidth={2} />
                {slaText}
              </span>
            </Tooltip>
          )}
          {snoozedUntil && new Date(snoozedUntil).getTime() > Date.now() && (
            <SnoozedBadge snoozedUntil={snoozedUntil} />
          )}
          {clientName && (
            <span className="rounded px-2 py-[3px] text-[11px] font-semibold bg-amber-500/15 text-amber-400 uppercase tracking-wide truncate max-w-[120px]" title={clientName}>
              {clientName}
            </span>
          )}
          {typeName && (
            <span className="rounded px-2 py-[3px] text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 uppercase tracking-wide">
              {typeName}
            </span>
          )}
          {categoryName && (
            <span className="rounded px-2 py-[3px] text-[11px] font-medium bg-[var(--overlay-hover)] text-primary">
              {categoryName}
            </span>
          )}
          {hasService && svc && (
            <span
              className="rounded px-2 py-[3px] text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: svc.bg, color: svc.text }}
            >
              {service}
            </span>
          )}
        </div>

        {/* Footer: date + assignee */}
        <div className="flex items-center gap-1.5">
          {completedAt ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <Check size={12} strokeWidth={2} />
              {completedAt}
            </span>
          ) : hasDue ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
              <Calendar size={12} strokeWidth={1.5} />
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
    </ContextMenu>
  );
}
