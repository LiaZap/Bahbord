'use client';

import { useState, useMemo, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { supabase } from '@/lib/supabase/client';
import KanbanColumn from './KanbanColumn';
import TicketCard from './TicketCard';
import BoardFilters, { type BoardFilterState } from './BoardFilters';

const columns: Array<{ id: keyof BoardItems; title: string; color: string }> = [
  { id: 'todo', title: 'Não iniciado', color: 'bg-slate-500' },
  { id: 'waiting', title: 'Aguardando resposta', color: 'bg-warning' },
  { id: 'progress', title: 'Em progresso', color: 'bg-accent' },
  { id: 'done', title: 'Concluído', color: 'bg-success' }
];

export type TicketItem = {
  id: string;
  title: string;
  service: string;
  due: string;
  assignee: string;
  priority: string;
  ticketKey: string;
  typeIcon: string;
};

type BoardItems = {
  todo: TicketItem[];
  waiting: TicketItem[];
  progress: TicketItem[];
  done: TicketItem[];
};

function findContainer(items: BoardItems, id: string) {
  return Object.keys(items).find((columnId) => items[columnId as keyof BoardItems].some((item) => item.id === id));
}

interface KanbanBoardProps {
  initialItems: BoardItems;
}

export default function KanbanBoard({ initialItems }: KanbanBoardProps) {
  const [items, setItems] = useState(initialItems);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>({
    search: '',
    services: [],
    assignees: [],
    types: [],
    priorities: [],
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Supabase Realtime — atualizar board quando tickets mudam
  useEffect(() => {
    const channel = supabase
      .channel('board-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        async () => {
          // Recarregar tickets quando houver mudança
          try {
            const res = await fetch('/api/tickets');
            if (!res.ok) return;
            const allTickets = await res.json();

            const normalizeStatus = (status: string | null) => {
              if (!status) return 'todo';
              const key = status.toUpperCase();
              if (key.includes('INICIADO')) return 'todo';
              if (key.includes('RESP')) return 'waiting';
              if (key.includes('PROGRESSO')) return 'progress';
              if (key.includes('CONCLU')) return 'done';
              return 'todo';
            };

            const mapTicket = (t: any) => ({
              id: t.id,
              title: t.title,
              service: t.service ?? t.service_name ?? 'Sem serviço',
              due: t.due ?? t.due_date ?? '-',
              assignee: t.assignee ?? t.assignee_name ?? 'Sem responsável',
              priority: t.priority ?? 'medium',
              ticketKey: t.ticketKey ?? t.ticket_key ?? t.id.substring(0, 8),
              typeIcon: t.typeIcon ?? t.type_icon ?? '📋',
            });

            setItems({
              todo: allTickets.filter((t: any) => normalizeStatus(t.status) === 'todo').map(mapTicket),
              waiting: allTickets.filter((t: any) => normalizeStatus(t.status) === 'waiting').map(mapTicket),
              progress: allTickets.filter((t: any) => normalizeStatus(t.status) === 'progress').map(mapTicket),
              done: allTickets.filter((t: any) => normalizeStatus(t.status) === 'done').map(mapTicket),
            });
          } catch {
            // Silencioso — falha de realtime não deve quebrar a UI
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Extrair opções disponíveis dos tickets
  const allTickets = useMemo(() =>
    Object.values(items).flat(),
    [items]
  );

  const availableServices = useMemo(() =>
    [...new Set(allTickets.map((t) => t.service).filter((s) => s !== 'Sem serviço'))],
    [allTickets]
  );

  const availableAssignees = useMemo(() =>
    [...new Set(allTickets.map((t) => t.assignee).filter((a) => a !== 'Sem responsável'))],
    [allTickets]
  );

  const availableTypes = useMemo(() => {
    const seen = new Set<string>();
    return allTickets
      .filter((t) => {
        if (seen.has(t.typeIcon)) return false;
        seen.add(t.typeIcon);
        return true;
      })
      .map((t) => ({ icon: t.typeIcon, name: t.typeIcon }));
  }, [allTickets]);

  // Filtrar tickets
  function filterTickets(tickets: TicketItem[]): TicketItem[] {
    return tickets.filter((t) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.ticketKey.toLowerCase().includes(q)) return false;
      }
      if (filters.services.length > 0 && !filters.services.includes(t.service)) return false;
      if (filters.assignees.length > 0 && !filters.assignees.includes(t.assignee)) return false;
      if (filters.types.length > 0 && !filters.types.includes(t.typeIcon)) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority)) return false;
      return true;
    });
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    setSelectedCard(active.id as string);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const sourceColumn = findContainer(items, active.id as string);
    const destinationColumn = findContainer(items, over.id as string) ?? (over.id as string);
    if (!sourceColumn || !destinationColumn || sourceColumn === destinationColumn) return;

    setItems((prev) => {
      const activeItem = prev[sourceColumn as keyof BoardItems].find((item) => item.id === active.id);
      if (!activeItem) return prev;
      return {
        ...prev,
        [sourceColumn]: prev[sourceColumn as keyof BoardItems].filter((item) => item.id !== active.id),
        [destinationColumn]: [...prev[destinationColumn as keyof BoardItems], activeItem]
      };
    });
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setSelectedCard(null);
    if (!over) return;

    const activeContainer = findContainer(items, active.id as string);
    const overContainer = findContainer(items, over.id as string) ?? (over.id as string);
    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      const activeIndex = items[activeContainer as keyof BoardItems].findIndex((item) => item.id === active.id);
      const overIndex = items[overContainer as keyof BoardItems].findIndex((item) => item.id === over.id);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer as keyof BoardItems], activeIndex, overIndex)
        }));
      }
      return;
    }

    try {
      await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: active.id, status_key: overContainer })
      });
    } catch (error) {
      console.error('Falha ao atualizar ticket:', error);
    }
  };

  // Encontrar o card sendo arrastado para o overlay
  const activeCard = selectedCard
    ? allTickets.find((t) => t.id === selectedCard)
    : null;

  return (
    <div className="flex h-full flex-col">
      <BoardFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableServices={availableServices}
        availableAssignees={availableAssignees}
        availableTypes={availableTypes}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-2.5 overflow-x-auto pb-2">
          {columns.map((column) => (
            <div key={column.id} className="w-[240px] shrink-0 xl:flex-1 xl:w-auto">
              <KanbanColumn
                id={column.id}
                title={column.title}
                color={column.color}
                cards={filterTickets(items[column.id])}
                activeItemId={selectedCard}
                onSelectCard={setSelectedCard}
              />
            </div>
          ))}
        </div>

        {/* Drag overlay — mostra uma cópia fluida do card durante o arraste */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeCard ? (
            <div className="w-[240px] rotate-2 opacity-90">
              <TicketCard
                {...activeCard}
                active={false}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
