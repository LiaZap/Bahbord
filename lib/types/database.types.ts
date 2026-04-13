export type TicketType = {
  id: string;
  workspace_id: string;
  name: string;
  icon: string;
  color: string;
  description_template: string;
};

export type Status = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  position: number;
  wip_limit: number | null;
  is_done: boolean;
};

export type Ticket = {
  id: string;
  workspace_id: string;
  ticket_type_id: string;
  status_id: string;
  service_id: string;
  category_id: string | null;
  sprint_id: string | null;
  parent_id: string | null;
  assignee_id: string | null;
  reporter_id: string | null;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};
