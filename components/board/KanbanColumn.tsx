'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils/cn';
import TicketCard from './TicketCard';

interface ColumnCard {
  id: string;
  title: string;
  service: string;
  due: string;
  assignee: string;
  priority: string;
  ticketKey: string;
  typeIcon: string;
}

interface ColumnProps {
  id: string;
  title: string;
  color: string;
  cards: ColumnCard[];
  activeItemId: string | null;
  onSelectCard: (id: string) => void;
}

const columnAccents: Record<string, string> = {
  todo: 'bg-slate-400',
  waiting: 'bg-amber-400',
  progress: 'bg-blue-400',
  done: 'bg-emerald-400',
};

export default function KanbanColumn({ id, title, color, cards, activeItemId, onSelectCard }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const accent = columnAccents[id] || color;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col rounded-lg transition-colors duration-200',
        isOver && 'bg-blue-500/[0.03]'
      )}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <div className={cn('h-2 w-2 rounded-full', accent)} />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </span>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[11px] font-semibold text-slate-500">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
          {cards.map((card) => (
            <TicketCard
              key={card.id}
              {...card}
              active={activeItemId === card.id}
              onClick={() => onSelectCard(card.id)}
            />
          ))}
          {cards.length === 0 && (
            <div className={cn(
              'flex h-20 items-center justify-center rounded-lg border border-dashed border-white/[0.06] text-[11px] text-slate-600 transition',
              isOver && 'border-blue-500/30 bg-blue-500/[0.03] text-blue-400'
            )}>
              {isOver ? 'Soltar aqui' : 'Nenhum ticket'}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
