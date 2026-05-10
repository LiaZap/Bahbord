/**
 * Tipos compartilhados pelo InitiativeDetail e seus sub-componentes.
 * Mantemos aqui pra evitar dependência circular entre os arquivos da pasta.
 */

import type { RoadmapMember, RoadmapProject } from '../RoadmapView';

export interface DetailProjectBreakdown {
  project_id: string;
  name: string;
  prefix: string;
  color: string | null;
  is_archived: boolean;
  weight: number;
  ticket_count: number;
  completed_count: number;
  percentage: number;
}

export interface DetailHealthEvent {
  created_at: string;
  actor_name: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface DetailInitiative {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  health: string;
  health_set_at: string | null;
  health_set_by: string | null;
  health_set_by_name: string | null;
  health_note: string | null;
  start_date: string | null;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  progress: {
    percentage: number;
    completed_tickets: number;
    total_tickets: number;
    projects_count: number;
  };
  projects: DetailProjectBreakdown[];
  health_history: DetailHealthEvent[];
}

export type DetailMember = RoadmapMember;
export type DetailProject = RoadmapProject;
