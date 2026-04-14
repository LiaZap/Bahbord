import KanbanBoard from '@/components/board/KanbanBoard';
import BoardShell from '@/components/board/BoardShell';
import { query, getDefaultWorkspaceId } from '@/lib/db';

type BoardTicket = {
  id: string;
  title: string;
  due: string | null;
  service_name: string | null;
  service_color: string | null;
  assignee_name: string | null;
  status_name: string | null;
  priority: string | null;
  ticket_key: string | null;
  type_icon: string | null;
};

type ServiceItem = { id: string; name: string };
type StatusItem = { id: string; name: string; wip_limit?: number | null };
type TicketTypeItem = { id: string; name: string };

function normalizeStatus(status: string | null) {
  if (!status) return 'todo';
  const key = status.toUpperCase();
  if (key.includes('INICIADO')) return 'todo';
  if (key.includes('RESP')) return 'waiting';
  if (key.includes('PROGRESSO')) return 'progress';
  if (key.includes('CONCLU')) return 'done';
  return 'todo';
}

function mapTicket(ticket: BoardTicket) {
  return {
    id: ticket.id,
    title: ticket.title,
    service: ticket.service_name ?? 'Sem serviço',
    serviceColor: ticket.service_color ?? null,
    due: ticket.due ?? '-',
    assignee: ticket.assignee_name ?? 'Sem responsável',
    priority: ticket.priority ?? 'medium',
    ticketKey: ticket.ticket_key ?? ticket.id.substring(0, 8),
    typeIcon: ticket.type_icon ?? '📋'
  };
}

export default async function BoardPage() {
  const result = await query(
    `SELECT
      id,
      title,
      priority,
      to_char(due_date AT TIME ZONE 'America/Sao_Paulo', 'DD Mon') AS due,
      service_name,
      service_color,
      assignee_name,
      status_name,
      ticket_key,
      type_icon
    FROM tickets_full
    WHERE is_archived = false
    ORDER BY created_at DESC`
  );

  const rows = result.rows as BoardTicket[];

  const wsId = await getDefaultWorkspaceId();
  const [serviceRows, statusRows, typeRows] = await Promise.all([
    query<ServiceItem>(`SELECT id, name FROM services WHERE workspace_id = $1 ORDER BY name ASC`, [wsId]),
    query<StatusItem>(`SELECT id, name, wip_limit FROM statuses WHERE workspace_id = $1 ORDER BY position ASC`, [wsId]),
    query<TicketTypeItem>(`SELECT id, name FROM ticket_types WHERE workspace_id = $1 ORDER BY position ASC`, [wsId])
  ]);

  const initialItems = {
    todo: rows.filter((t) => normalizeStatus(t.status_name) === 'todo').map(mapTicket),
    waiting: rows.filter((t) => normalizeStatus(t.status_name) === 'waiting').map(mapTicket),
    progress: rows.filter((t) => normalizeStatus(t.status_name) === 'progress').map(mapTicket),
    done: rows.filter((t) => normalizeStatus(t.status_name) === 'done').map(mapTicket)
  };

  // Montar mapa de WIP limits por coluna
  const wipLimits: Record<string, number | null> = {};
  for (const s of statusRows.rows) {
    const key = normalizeStatus(s.name);
    if (s.wip_limit) wipLimits[key] = s.wip_limit;
  }

  return (
    <BoardShell services={serviceRows.rows} statuses={statusRows.rows} ticketTypes={typeRows.rows}>
      <KanbanBoard initialItems={initialItems} wipLimits={wipLimits} />
    </BoardShell>
  );
}
