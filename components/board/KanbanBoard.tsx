'use client';

import { useMemo } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import TicketCard from './TicketCard';
import BoardFilters from './BoardFilters';
import { useBoard, type BoardItems } from '@/lib/hooks/useBoard';

export type { TicketItem, BoardItems } from '@/lib/hooks/useBoard';

const columns: Array<{ id: keyof BoardItems; title: string; color: string }> = [
  { id: 'todo', title: 'Não iniciado', color: 'bg-slate-500' },
  { id: 'waiting', title: 'Aguardando resposta', color: 'bg-warning' },
  { id: 'progress', title: 'Em progresso', color: 'bg-accent' },
  { id: 'done', title: 'Concluído', color: 'bg-success' }
];

interface KanbanBoardProps {
  initialItems: BoardItems;
  wipLimits?: Record<string, number | null>;
}

export default function KanbanBoard({ initialItems, wipLimits = {} }: KanbanBoardProps) {
  const {
    items,
    selectedCard,
    setSelectedCard,
    filters,
    setFilters,
    filterTickets,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    allTickets,
  } = useBoard(initialItems, wipLimits);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
        <div className="flex gap-3 pb-2 overflow-x-auto snap-x snap-mandatory md:snap-none">
          {columns.map((column) => (
            <div key={column.id} className="w-[260px] shrink-0 snap-start">
              <KanbanColumn
                id={column.id}
                title={column.title}
                color={column.color}
                cards={filterTickets(items[column.id])}
                activeItemId={selectedCard}
                onSelectCard={setSelectedCard}
                wipLimit={wipLimits[column.id] ?? null}
              />
            </div>
          ))}
        </div>

        {/* Drag overlay — mostra uma cópia fluida do card durante o arraste */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeCard ? (
            <div className="w-[220px] rotate-2 opacity-90">
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
