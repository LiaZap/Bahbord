'use client';

import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils/cn';
import TicketCard from './TicketCard';
import { useBoardShell } from './BoardShell';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useProject } from '@/lib/project-context';

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
}

interface ColumnProps {
  id: string;
  title: string;
  color: string;
  cards: ColumnCard[];
  activeItemId: string | null;
  onSelectCard: (id: string) => void;
  wipLimit?: number | null;
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

export default function KanbanColumn({ id, title, color, cards, activeItemId, onSelectCard, wipLimit }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { createInColumn } = useBoardShell();
  const accent = columnAccents[id] || color;
  const router = useRouter();
  const { toast } = useToast();
  const { currentProjectId, currentBoardId } = useProject();

  const [quickCreate, setQuickCreate] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleQuickCreate() {
    if (!quickTitle.trim() || creating) return;
    setCreating(true);
    try {
      const statusName = statusKeyToName[id];
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickTitle.trim(),
          status_id: null,
          priority: 'medium',
          project_id: currentProjectId || null,
          board_id: currentBoardId || null,
        }),
      });

      // Buscar o status correto e atualizar
      const optRes = await fetch('/api/options?type=statuses');
      if (optRes.ok) {
        const statuses = await optRes.json();
        const match = statuses.find((s: any) => s.name.toUpperCase() === statusName);
        if (match && res.ok) {
          const ticket = await res.json();
          await fetch(`/api/tickets/${ticket.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_id: match.id }),
          });
        }
      }

      toast('Ticket criado', 'success');
      setQuickTitle('');
      setQuickCreate(false);
      router.refresh();
    } catch {
      toast('Erro ao criar', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col transition-all duration-200',
        isOver && 'bg-blue-500/[0.03] rounded-lg'
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-sm', accent)} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
          <span className={cn('text-[11px] font-semibold tabular-nums', wipLimit && cards.length >= wipLimit ? 'text-amber-400' : 'text-slate-600')}>
            {cards.length}{wipLimit ? `/${wipLimit}` : ''}
          </span>
        </div>
        <button
          onClick={() => createInColumn(id)}
          className="rounded p-0.5 text-slate-600 transition hover:bg-white/[0.06] hover:text-slate-300"
          title="Criar ticket"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Cards */}
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-[5px] overflow-y-auto">
          {cards.map((card) => (
            <TicketCard
              key={card.id}
              {...card}
              active={activeItemId === card.id}
              onClick={() => onSelectCard(card.id)}
            />
          ))}
          {cards.length === 0 && !isOver && (
            <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-white/[0.04] text-[11px] text-slate-600">
              Sem tickets
            </div>
          )}
          {isOver && (
            <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-blue-500/30 bg-blue-500/[0.04] text-[11px] text-blue-400">
              Soltar aqui
            </div>
          )}
        </div>
      </SortableContext>

      {/* Quick create inline */}
      {quickCreate ? (
        <div className="mt-1.5 rounded-md border border-white/[0.08] bg-[var(--card-bg)] p-2">
          <input
            autoFocus
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickCreate();
              if (e.key === 'Escape') { setQuickCreate(false); setQuickTitle(''); }
            }}
            placeholder="O que precisa ser feito?"
            className="w-full bg-transparent text-[12px] text-slate-200 outline-none placeholder:text-slate-600"
            disabled={creating}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <button
              onClick={handleQuickCreate}
              disabled={!quickTitle.trim() || creating}
              className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              {creating ? '...' : 'Criar'}
            </button>
            <button
              onClick={() => { setQuickCreate(false); setQuickTitle(''); }}
              className="rounded p-0.5 text-slate-600 hover:text-slate-300"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setQuickCreate(true)}
          className="mt-1.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-slate-600 transition hover:bg-white/[0.04] hover:text-slate-400"
        >
          <Plus size={13} />
          Criar ticket
        </button>
      )}
    </section>
  );
}
