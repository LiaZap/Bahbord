'use client';

import { useMemo, useState, useEffect } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import TicketCard from './TicketCard';
import BoardFilters from './BoardFilters';
import BulkActionBar from './BulkActionBar';
import EmptyState from '@/components/ui/EmptyState';
import { useBoardShell } from './BoardShell';
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
  availableProjects?: { id: string; name: string }[];
}

export default function KanbanBoard({ initialItems, wipLimits = {}, availableProjects = [] }: KanbanBoardProps) {
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
    overdueCount,
  } = useBoard(initialItems, wipLimits);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { createInColumn } = useBoardShell();

  // Bulk selection (Cmd/Ctrl+Click no card)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; color: string }>>([]);

  useEffect(() => {
    fetch('/api/options?type=statuses')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setStatuses(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Esc limpa seleção
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds.size]);

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

  const hasAnyTickets = allTickets.length > 0;
  const hasActiveFilters =
    !!filters.search ||
    filters.services.length > 0 ||
    filters.assignees.length > 0 ||
    filters.types.length > 0 ||
    filters.priorities.length > 0 ||
    filters.projects.length > 0 ||
    !!filters.onlyOverdue;

  return (
    <div className="flex h-full flex-col">
      <BoardFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableServices={availableServices}
        availableAssignees={availableAssignees}
        availableTypes={availableTypes}
        availableProjects={availableProjects}
        overdueCount={overdueCount}
      />

      {!hasAnyTickets && !hasActiveFilters ? (
        <EmptyState
          illustration="tickets"
          title="Nenhum ticket aqui ainda"
          description="Crie o primeiro ticket pra começar a organizar o trabalho do board."
          actions={[
            { label: 'Novo ticket', onClick: () => createInColumn('todo'), variant: 'primary' },
          ]}
        />
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        autoScroll={{
          enabled: true,
          // Aciona scroll quando o cursor está em 25% da borda (vertical e horizontal)
          threshold: { x: 0.15, y: 0.25 },
          acceleration: 12,
          interval: 5,
        }}
      >
        {/* Mobile: scroll horizontal com snap; Desktop: layout natural */}
        <div className="flex gap-3 pb-2 overflow-x-auto snap-x snap-mandatory md:snap-none -mx-2 px-2 sm:mx-0 sm:px-0">
          {columns.map((column) => (
            <div key={column.id} className="w-[85vw] max-w-[280px] sm:w-[260px] shrink-0 snap-start">
              <KanbanColumn
                id={column.id}
                title={column.title}
                color={column.color}
                cards={filterTickets(items[column.id])}
                activeItemId={selectedCard}
                onSelectCard={setSelectedCard}
                wipLimit={wipLimits[column.id] ?? null}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
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
      )}

      {/* Floating bulk action bar */}
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        statuses={statuses}
      />
    </div>
  );
}
