'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ActivityEntry {
  id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor_name: string | null;
}

export function useActivityLog(ticketId: string) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/activity-log?ticket_id=${ticketId}`);
      if (res.ok) {
        setActivities(await res.json());
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, refetch: fetchActivities };
}
