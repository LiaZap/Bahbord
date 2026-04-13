'use client';

import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils/cn';

const priorityConfig: Record<string, { color: string; label: string }> = {
  urgent: { color: 'bg-red-500', label: 'Urgente' },
  high: { color: 'bg-orange-400', label: 'Alta' },
  medium: { color: 'bg-yellow-400', label: 'Média' },
  low: { color: 'bg-blue-400', label: 'Baixa' }
};

const serviceColors: Record<string, string> = {
  BAHTECH: 'bg-sky-500/15 text-sky-400',
  BAHVITRINE: 'bg-emerald-500/15 text-emerald-400',
  BAHSAUDE: 'bg-green-500/15 text-green-400',
  BAHCOUNT: 'bg-amber-500/15 text-amber-400',
  BAHFLASH: 'bg-rose-500/15 text-rose-400',
  BAHPROJECT: 'bg-cyan-500/15 text-cyan-400',
  LOVATTOFIT: 'bg-violet-500/15 text-violet-400',
  EQUINOX: 'bg-yellow-500/15 text-yellow-400'
};

function getServiceColor(service: string) {
  const upper = service.toUpperCase();
  for (const [key, val] of Object.entries(serviceColors)) {
    if (upper.includes(key)) return val;
  }
  return 'bg-slate-500/15 text-slate-400';
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

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'group cursor-grab rounded-lg border border-border/40 bg-surface2 p-3 shadow-sm shadow-black/10 transition active:cursor-grabbing',
        isDragging ? 'opacity-50 shadow-xl' : 'hover:border-border hover:shadow-md hover:shadow-black/15',
        active && 'ring-1 ring-accent/60'
      )}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      {/* Header: key + service */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', prio.color)} title={prio.label} />
        <span className="text-[11px]">{typeIcon}</span>
        <Link
          href={`/ticket/${id}`}
          className="truncate font-mono text-[11px] text-slate-500 transition hover:text-accent"
          onClick={(e) => e.stopPropagation()}
        >
          {ticketKey}
        </Link>
        <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold', getServiceColor(service))}>
          {service}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-medium leading-snug text-slate-200">{title}</h3>

      {/* Footer: date + assignee */}
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-slate-600">{due}</span>
        {initials ? (
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[9px] font-bold text-accent"
            title={assignee}
          >
            {initials}
          </div>
        ) : null}
      </div>
    </article>
  );
}
