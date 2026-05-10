/**
 * Tipos compartilhados pelos sub-componentes do WorkloadView.
 * Espelham o response de /api/reports/workload.
 */

export interface WorkloadProject {
  id: string;
  name: string;
  color: string | null;
}

export interface WorkloadTicket {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  due_date: string | null;
  estimate_minutes: number;
}

export interface WorkloadWeek {
  week_start: string;
  week_end: string;
  ticket_count: number;
  estimate_minutes: number;
  tickets: WorkloadTicket[];
}

export interface WorkloadMember {
  member_id: string;
  display_name: string;
  avatar_url: string | null;
  weeks: WorkloadWeek[];
  total_minutes: number;
  total_tickets: number;
}

export interface WorkloadResponse {
  period: { from: string; to: string };
  members: WorkloadMember[];
}

export interface MeData {
  id: string;
  display_name: string;
  role: string;
}

export interface CellSelection {
  member: WorkloadMember;
  week: WorkloadWeek;
}

export const MINUTES_PER_DAY = 8 * 60; // 8h workday
export const MINUTES_PER_WEEK = 5 * MINUTES_PER_DAY; // 40h

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-sky-500',
};
