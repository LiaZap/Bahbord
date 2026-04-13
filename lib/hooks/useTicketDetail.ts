'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TicketDetail {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  ticket_key: string;
  type_name: string;
  type_icon: string;
  type_color: string;
  status_id: string;
  status_name: string;
  status_color: string;
  service_id: string;
  service_name: string;
  service_color: string;
  assignee_id: string | null;
  assignee_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  category_id: string | null;
  category_name: string | null;
  sprint_id: string | null;
  sprint_name: string | null;
  parent_id: string | null;
  parent_key: string | null;
  parent_title: string | null;
  ticket_type_id: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  subtask_count: number;
  subtask_done_count: number;
  comment_count: number;
  total_time_minutes: number;
}

export function useTicketDetail(ticketId: string) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setTicket(data);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const updateField = useCallback(async (field: string, value: unknown) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        await fetchTicket();
      }
    } catch {
      // silencioso
    }
  }, [ticketId, fetchTicket]);

  return { ticket, loading, updateField, refetch: fetchTicket };
}
