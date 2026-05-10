export type InboxStatus = 'pending' | 'accepted' | 'rejected' | 'duplicate';
export type InboxSource =
  | 'slack'
  | 'sentry'
  | 'share_link'
  | 'email'
  | 'manual'
  | 'github';

export type InboxPriority = 'urgent' | 'high' | 'medium' | 'low';
export type InboxConfidence = 'high' | 'medium' | 'low';

export interface InboxAiSuggestion {
  priority?: InboxPriority;
  suggested_project_id?: string | null;
  suggested_labels?: string[];
  suggested_assignee_id?: string | null;
  duplicate_ticket_id?: string | null;
  duplicate_score?: number | null;
  summary?: string | null;
  reasoning?: string | null;
  confidence?: InboxConfidence;
}

export interface InboxItem {
  id: string;
  workspace_id: string;
  source: InboxSource | string;
  source_external_id: string | null;
  title: string;
  description: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  status: InboxStatus;
  ai_suggestion: InboxAiSuggestion | null;
  resulting_ticket_id: string | null;
  duplicate_of_ticket_id: string | null;
  reject_reason: string | null;
  created_at: string;
  triaged_at: string | null;
  triaged_by: string | null;
}

export interface InboxListResponse {
  data: InboxItem[];
  pagination: { limit: number; offset: number; total: number };
}

export interface OptionItem {
  id: string;
  name: string;
  display_name?: string;
  color?: string | null;
  prefix?: string | null;
  avatar_url?: string | null;
  is_done?: boolean;
  is_default?: boolean;
  project_id?: string;
  type?: string;
  icon?: string;
  position?: number;
}

export interface TicketSearchResult {
  id: string;
  title: string;
  ticket_key: string;
  status_name?: string;
  status_color?: string;
  service_name?: string;
  assignee_name?: string;
  type_icon?: string;
}
