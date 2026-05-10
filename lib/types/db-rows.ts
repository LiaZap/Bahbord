/**
 * Shapes canônicos das rows do Postgres na fronteira Server Component →
 * Client Component. Use em vez de `as any[]` ao passar `result.rows`.
 *
 * Mantém type safety end-to-end e documenta o contrato esperado.
 *
 * Estes tipos são *supersets* — campos opcionais aparecem quando a query
 * SELECT pede, e ficam `undefined` caso contrário. Use `Pick<TicketRow, ...>`
 * em consumidores que só precisam de um subconjunto.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tickets (view tickets_full + projeções)
// ─────────────────────────────────────────────────────────────────────────────

export interface TicketRow {
  id: string;
  ticket_key: string;
  workspace_id?: string;
  title: string;
  description?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  status_id?: string | null;
  status_name?: string | null;
  status_color?: string | null;
  is_done?: boolean | null;
  ticket_type_id?: string | null;
  type_name?: string | null;
  type_icon?: string | null;
  type_color?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  service_color?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  reporter_id?: string | null;
  reporter_name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  parent_id?: string | null;
  parent_key?: string | null;
  parent_title?: string | null;
  sprint_id?: string | null;
  sprint_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  project_prefix?: string | null;
  project_color?: string | null;
  board_id?: string | null;
  board_name?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  is_archived?: boolean;
  snoozed_until?: string | null;
  sla_due_at?: string | null;
  subtask_count?: number | null;
  subtask_done_count?: number | null;
  comment_count?: number | null;
  attachment_count?: number | null;

  // Campos formatados pela camada de query (to_char) — opcionais.
  due?: string | null;
  created?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprints
// ─────────────────────────────────────────────────────────────────────────────

export interface SprintRow {
  id: string;
  workspace_id?: string;
  project_id?: string | null;
  name: string;
  goal?: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_completed?: boolean | null;
  auto_rollover?: boolean | null;
  cadence_days?: number | null;
  rollover_strategy?: string | null;
  parent_sprint_id?: string | null;
  rolled_over_at?: string | null;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Members
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberRow {
  id: string;
  workspace_id?: string;
  user_id?: string | null;
  clerk_user_id?: string | null;
  display_name: string;
  email?: string;
  role?: 'owner' | 'admin' | 'member' | 'viewer' | string;
  avatar_url?: string | null;
  is_approved?: boolean;
  is_archived?: boolean | null;
  is_client?: boolean | null;
  can_track_time?: boolean | null;
  phone?: string | null;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  workspace_id?: string;
  name: string;
  prefix?: string;
  description?: string | null;
  color: string | null;
  is_archived?: boolean;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Statuses
// ─────────────────────────────────────────────────────────────────────────────

export interface StatusRow {
  id: string;
  name: string;
  color?: string | null;
  position?: number;
  wip_limit?: number | null;
  is_done?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregações usadas em dashboards (chart cards)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartCountRow {
  name: string;
  color: string;
  value: number;
}

export interface ChartTypeRow extends ChartCountRow {
  last_30d: number;
  last_7d: number;
}

export interface WeeklyCompletedRow {
  week: string;
  value: number;
}

export interface AssigneeBreakdownRow {
  name: string;
  total: number;
  done: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats agregadas para shares/painéis públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface ShareDashboardStats {
  total_active: number;
  in_progress: number;
  completed_month: number;
}
