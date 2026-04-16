'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { supabase } from '@/lib/supabase/client';
import { type BoardFilterState } from '@/components/board/BoardFilters';
import { useToast } from '@/components/ui/Toast';

export type TicketItem = {
  id: string;
  title: string;
  service: string;
  serviceColor: string | null;
  due: string;
  assignee: string;
  priority: string;
  ticketKey: string;
  typeIcon: string;
  typeName?: string;
  categoryName?: string;
  completedAt?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  assigneeAvatar?: string | null;
};

export type BoardItems = {
  todo: TicketItem[];
  waiting: TicketItem[];
  progress: TicketItem[];
  done: TicketItem[];
};

function findContainer(items: BoardItems, id: string) {
  return Object.keys(items).find((columnId) => items[columnId as keyof BoardItems].some((item) => item.id === id));
}

export function useBoard(initialItems: BoardItems, wipLimits: Record<string, number | null>) {
  const [items, setItems] = useState(initialItems);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [dragSourceColumn, setDragSourceColumn] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>({
    search: '',
    services: [],
    assignees: [],
    types: [],
    priorities: [],
    projects: [],
  });

  const { toast } = useToast();

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
              serviceColor: t.serviceColor ?? t.service_color ?? null,
              due: t.due ?? t.due_date ?? '-',
              assignee: t.assignee ?? t.assignee_name ?? 'Sem responsável',
              priority: t.priority ?? 'medium',
              ticketKey: t.ticketKey ?? t.ticket_key ?? t.id.substring(0, 8),
              typeIcon: t.typeIcon ?? t.type_icon ?? '📋',
              typeName: t.typeName ?? t.type_name ?? undefined,
              categoryName: t.categoryName ?? t.category_name ?? undefined,
              completedAt: t.completedAt ?? t.completed_at ?? null,
              clientName: t.clientName ?? t.client_name ?? null,
              projectId: t.projectId ?? t.project_id ?? null,
              assigneeAvatar: t.assigneeAvatar ?? t.assignee_avatar ?? null,
            });

            setItems({
              todo: allTickets.filter((t: any) => normalizeStatus(t.status) === 'todo').map(mapTicket),
              waiting: allTickets.filter((t: any) => normalizeStatus(t.status) === 'waiting').map(mapTicket),
              progress: allTickets.filter((t: any) => normalizeStatus(t.status) === 'progress').map(mapTicket),
              done: allTickets.filter((t: any) => normalizeStatus(t.status) === 'done').map(mapTicket),
            });
          } catch (err) {
            console.error('Erro ao atualizar board via realtime:', err);
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
      if (filters.projects.length > 0 && (!t.projectId || !filters.projects.includes(t.projectId))) return false;
      return true;
    });
  }

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setSelectedCard(active.id as string);
    setDragSourceColumn(findContainer(items, active.id as string) || null);
  }, [items]);

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) return;
    const sourceColumn = findContainer(items, active.id as string);
    const destinationColumn = findContainer(items, over.id as string) ?? (over.id as string);
    if (!sourceColumn || !destinationColumn || sourceColumn === destinationColumn) return;

    // Validar WIP limit
    const limit = wipLimits[destinationColumn];
    if (limit && items[destinationColumn as keyof BoardItems].length >= limit) {
      return; // Bloqueia o move
    }

    setItems((prev) => {
      const activeItem = prev[sourceColumn as keyof BoardItems].find((item) => item.id === active.id);
      if (!activeItem) return prev;
      return {
        ...prev,
        [sourceColumn]: prev[sourceColumn as keyof BoardItems].filter((item) => item.id !== active.id),
        [destinationColumn]: [...prev[destinationColumn as keyof BoardItems], activeItem]
      };
    });
  }, [items, wipLimits]);

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    const originalColumn = dragSourceColumn;
    setSelectedCard(null);
    setDragSourceColumn(null);
    if (!over) return;

    const currentContainer = findContainer(items, active.id as string);
    const overContainer = findContainer(items, over.id as string) ?? (over.id as string);
    if (!currentContainer || !overContainer) return;

    // Use original column to detect if column actually changed
    const sourceColumn = originalColumn || currentContainer;

    // Same column — just reorder
    if (sourceColumn === overContainer) {
      const activeIndex = items[currentContainer as keyof BoardItems].findIndex((item) => item.id === active.id);
      const overIndex = items[overContainer as keyof BoardItems].findIndex((item) => item.id === over.id);
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [currentContainer]: arrayMove(prev[currentContainer as keyof BoardItems], activeIndex, overIndex)
        }));
      }
      return;
    }

    // Different column — update status in API
    // Validar WIP limit
    const limit = wipLimits[overContainer];
    if (limit && items[overContainer as keyof BoardItems].length > limit) {
      toast(`Limite WIP atingido (${limit}) nesta coluna`, 'warning');
      return;
    }

    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: active.id, status_key: overContainer })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'Erro ao mover ticket', 'error');
      }
    } catch {
      toast('Erro ao mover ticket', 'error');
    }
  }, [items, wipLimits, toast]);

  return {
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
  };
}
