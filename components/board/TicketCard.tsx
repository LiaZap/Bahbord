'use client';

import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils/cn';
import { Calendar } from 'lucide-react';

const priorityConfig: Record<string, { color: string; border: string; label: string }> = {
  urgent: { color: 'bg-red-500', border: 'border-l-red-500', label: 'Urgente' },
  high: { color: 'bg-orange-400', border: 'border-l-orange-400', label: 'Alta' },
  medium: { color: 'bg-blue-400', border: 'border-l-blue-400', label: 'Média' },
  low: { color: 'bg-slate-400', border: 'border-l-slate-500', label: 'Baixa' }
};

const serviceColors: Record<string, string> = {
  BAHTECH: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
  BAHVITRINE: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  BAHSAUDE: 'bg-green-500/10 text-green-400 ring-green-500/20',
  BAHCOUNT: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  BAHFLASH: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
  BAHPROJECT: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20',
  LOVATTOFIT: 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
  EQUINOX: 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20'
};

function getServiceColor(service: string) {
  const upper = service.toUpperCase();
  for (const [key, val] of Object.entries(serviceColors)) {
    if (upper.includes(key)) return val;
  }
  return 'bg-slate-500/10 text-slate-400 ring-slate-500/20';
}

interface TicketCardProps {
  id: string;
  title: string;
  service: string;
  due: string;
  assignee: string;
  priority: string;
  ticketKey: string;
  typeIcon: string;
  active: boolean;
  onClick: () => void;
}

export default function TicketCard({ id, title, service, due, assignee, priority, ticketKey, typeIcon, active, onClick }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const prio = priorityConfig[priority] || priorityConfig.medium;
  const initials = assignee !== 'Sem responsável'
    ? assignee.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : null;

  const hasService = service && service !== 'Sem serviço';

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'group cursor-grab rounded-md border border-white/[0.06] bg-[#22252a] transition-all duration-150 active:cursor-grabbing',
        'hover:border-white/[0.1] hover:bg-[#272b31]',
        'border-l-[3px]',
        prio.border,
        isDragging && 'opacity-40 rotate-1 shadow-2xl scale-[1.02]',
        active && 'ring-1 ring-blue-500/40'
      )}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <div className="p-3">
        {/* Top: key + type */}
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[13px]">{typeIcon}</span>
          <Link
            href={`/ticket/${id}`}
            className="font-mono text-[11px] font-medium text-slate-500 transition hover:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            {ticketKey}
          </Link>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-[13px] font-medium leading-[1.4] text-slate-200 line-clamp-2">
          {title}
        </h3>

        {/* Service badge */}
        {hasService && (
          <div className="mb-2">
            <span className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
              getServiceColor(service)
            )}>
              {service}
            </span>
          </div>
        )}

        {/* Footer: due date + assignee */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            {due && due !== '-' && (
              <>
                <Calendar size={11} />
                <span>{due}</span>
              </>
            )}
          </div>
          {initials && (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-[9px] font-bold text-blue-300 ring-1 ring-white/[0.06]"
              title={assignee}
            >
              {initials}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
