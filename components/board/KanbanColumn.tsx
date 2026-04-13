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

export default function KanbanColumn({ id, title, color, cards, activeItemId, onSelectCard }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col',
        isOver ? 'rounded-lg bg-white/[0.02]' : ''
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn('h-2.5 w-2.5 rounded-sm', color)} />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          {cards.length}
        </span>
      </div>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {cards.map((card) => (
            <TicketCard
              key={card.id}
              {...card}
              active={activeItemId === card.id}
              onClick={() => onSelectCard(card.id)}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
