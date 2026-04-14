'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  completed_at: string | null;
  assignee_name: string | null;
}

export function useSubtasks(ticketId: string) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubtasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/subtasks?ticket_id=${ticketId}`);
      if (res.ok) {
        setSubtasks(await res.json());
      }
    } catch (err) {
      console.error('Erro ao carregar subtasks:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const addSubtask = useCallback(async (title: string) => {
    const res = await fetch('/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId, title }),
    });
    if (res.ok) {
      await fetchSubtasks();
    }
  }, [ticketId, fetchSubtasks]);

  const toggleSubtask = useCallback(async (id: string, completed: boolean) => {
    const res = await fetch('/api/subtasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_completed: completed }),
    });
    if (res.ok) {
      await fetchSubtasks();
    }
  }, [fetchSubtasks]);

  const deleteSubtask = useCallback(async (id: string) => {
    const res = await fetch(`/api/subtasks?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchSubtasks();
    }
  }, [fetchSubtasks]);

  return { subtasks, loading, addSubtask, toggleSubtask, deleteSubtask, refetch: fetchSubtasks };
}
