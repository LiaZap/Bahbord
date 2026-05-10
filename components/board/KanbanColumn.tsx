'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils/cn';
import TicketCard from './TicketCard';
import { useBoardShell } from './BoardShell';
import { Plus } from 'lucide-react';

interface ColumnCard {
  id: string;
  title: string;
  service: string;
  due: string;
  assignee: string;
  priority: string;
  ticketKey: string;
  typeIcon: string;
  typeName?: string;
  categoryName?: string;
  completedAt?: string | null;
  clientName?: string | null;
  snoozedUntil?: string | null;
  slaDueAt?: string | null;
}

interface ColumnProps {
  id: string;
  title: string;
  color: string;
  cards: ColumnCard[];
  activeItemId: string | null;
  onSelectCard: (id: string) => void;
  wipLimit?: number | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const columnAccents: Record<string, string> = {
  todo: 'bg-slate-400',
  waiting: 'bg-amber-400',
  progress: 'bg-blue-500',
  done: 'bg-emerald-500',
};

const statusKeyToName: Record<string, string> = {
  todo: 'NÃO INICIADO',
  waiting: 'AGUARDANDO RESPOSTA',
  progress: 'EM PROGRESSO',
  done: 'CONCLUÍDO',
};

export default function KanbanColumn({ id, title, color, cards, activeItemId, onSelectCard, wipLimit, selectedIds, onToggleSelect }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { createInColumn } = useBoardShell();
  const accent = columnAccents[id] || color;

  return (
    <section
      ref={setNodeRef}
      aria-label={`Coluna ${title} - ${cards.length} tickets`}
      className={cn(
        'flex min-h-0 flex-col transition-all duration-200',
        isOver && 'bg-blue-500/[0.03] rounded-lg'
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-sm', accent)} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary-muted">{title}</span>
          <span className={cn('text-[11px] font-semibold tabular-nums', wipLimit && cards.length >= wipLimit ? 'text-amber-400' : 'text-tertiary-muted')}>
            {cards.length}{wipLimit ? `/${wipLimit}` : ''}
          </span>
        </div>
        <button
          onClick={() => createInColumn(id)}
          className="rounded p-0.5 text-tertiary-muted transition hover:bg-[var(--overlay-hover)] hover:text-primary"
          title="Criar ticket"
          aria-label={`Criar ticket em ${title}`}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Cards — min-h-[100px] garante área de drop mesmo coluna vazia */}
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-[5px] overflow-y-auto min-h-[100px] pr-1">
          {cards.map((card) => (
            <TicketCard
              key={card.id}
              {...card}
              active={activeItemId === card.id}
              selected={selectedIds?.has(card.id)}
              onToggleSelect={onToggleSelect ? () => onToggleSelect(card.id) : undefined}
              onClick={() => onSelectCard(card.id)}
            />
          ))}
          {cards.length === 0 && !isOver && (
            <button
              onClick={() => createInColumn(id)}
              className="group/empty flex w-full h-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[var(--card-border)] text-[11px] text-[var(--text-tertiary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
            >
              <Plus size={16} strokeWidth={1.5} className="opacity-60 group-hover/empty:opacity-100" />
              Nenhum ticket aqui
              <span className="text-[10px] opacity-60">clique pra criar</span>
            </button>
          )}
          {isOver && (
            <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-blue-500/30 bg-blue-500/[0.04] text-[11px] text-blue-400">
              Soltar aqui
            </div>
          )}
        </div>
      </SortableContext>

      {/* Create ticket - opens full modal */}
      <button
        onClick={() => createInColumn(id)}
        className="mt-1.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-tertiary-muted transition hover:bg-[var(--overlay-hover)] hover:text-secondary-muted"
      >
        <Plus size={13} />
        Criar ticket
      </button>
    </section>
  );
}
