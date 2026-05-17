export const dynamic = "force-dynamic";
import { redirect } from 'next/navigation';
import KanbanBoard from '@/components/board/KanbanBoard';
import BoardShell from '@/components/board/BoardShell';
import { query } from '@/lib/db';
import { db } from '@/lib/drizzle';
import { statuses, services, ticketTypes } from '@/lib/schema/core';
import { projects } from '@/lib/schema/tickets';
import { eq, asc } from 'drizzle-orm';
import { isAdmin } from '@/lib/api-auth';
import { hasBoardAccess, hasProjectAccess } from '@/lib/access-check';
import { requireApproved } from '@/lib/page-guards';

type BoardTicket = {
  id: string;
  title: string;
  due: string | null;
  service_name: string | null;
  service_color: string | null;
  assignee_name: string | null;
  status_id: string | null;
  status_name: string | null;
  priority: string | null;
  ticket_key: string | null;
  type_icon: string | null;
  type_name: string | null;
  category_name: string | null;
  completed_at: string | null;
  client_name: string | null;
  project_id: string | null;
  assignee_avatar: string | null;
  snoozed_until: string | null;
  sla_due_at: string | null;
  customer_request_count: number | null;
};

type ProjectItem = { id: string; name: string };

type ServiceItem = { id: string; name: string };
type StatusItem = { id: string; name: string; color: string; position: number; wip_limit?: number | null; is_done?: boolean };
type TicketTypeItem = { id: string; name: string };

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
    typeIcon: ticket.type_icon ?? '📋',
    typeName: ticket.type_name ?? undefined,
    categoryName: ticket.category_name ?? undefined,
    completedAt: ticket.completed_at ?? null,
    clientName: ticket.client_name ?? null,
    projectId: ticket.project_id ?? null,
    assigneeAvatar: ticket.assignee_avatar ?? null,
    snoozedUntil: ticket.snoozed_until ?? null,
    slaDueAt: ticket.sla_due_at ?? null,
    customerRequestCount: Number(ticket.customer_request_count ?? 0),
  };
}

export default async function BoardPage({ searchParams }: { searchParams: { board_id?: string; project_id?: string } }) {
  const { board_id, project_id } = await searchParams;
  const auth = await requireApproved();
  const userIsAdmin = isAdmin(auth.role);

  // Validate access BEFORE querying tickets (skip for admins)
  if (!userIsAdmin) {
    if (board_id) {
      const ok = await hasBoardAccess(auth, board_id);
      if (!ok) redirect('/my-tasks');
    } else if (project_id) {
      const ok = await hasProjectAccess(auth, project_id);
      if (!ok) redirect('/my-tasks');
    }
  }

  let whereClause = 'WHERE is_archived = false';
  const queryParams: string[] = [];

  if (board_id) {
    queryParams.push(board_id);
    whereClause = `WHERE board_id = $${queryParams.length} AND is_archived = false`;
  } else if (project_id) {
    queryParams.push(project_id);
    whereClause = `WHERE project_id = $${queryParams.length} AND is_archived = false`;
  } else if (auth && !userIsAdmin) {
    // Non-admin: show only tickets from boards they have access to
    queryParams.push(auth.id);
    whereClause = `WHERE is_archived = false AND board_id IN (SELECT board_id FROM board_roles WHERE member_id = $${queryParams.length})`;
  }

  const result = await query(
    `SELECT
      id,
      title,
      priority,
      status_id,
      to_char(due_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') AS due,
      service_name,
      service_color,
      assignee_name,
      (SELECT m.avatar_url FROM members m WHERE m.id = assignee_id) AS assignee_avatar,
      status_name,
      ticket_key,
      type_icon,
      type_name,
      category_name,
      to_char(completed_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') AS completed_at,
      (SELECT cl.name FROM clients cl WHERE cl.id = client_id) AS client_name,
      project_id,
      snoozed_until,
      sla_due_at,
      (SELECT COUNT(*)::int FROM customer_requests cr WHERE cr.ticket_id = tickets_full.id) AS customer_request_count
    FROM tickets_full
    ${whereClause}
    ORDER BY updated_at DESC`,
    queryParams.length > 0 ? queryParams : undefined
  );

  const rows = result.rows as BoardTicket[];

  const [serviceRows, statusRows, typeRows, projectRows] = await Promise.all([
    db.select({ id: services.id, name: services.name }).from(services).orderBy(asc(services.name)),
    db.select({ id: statuses.id, name: statuses.name, color: statuses.color, position: statuses.position, wip_limit: statuses.wipLimit, is_done: statuses.isDone })
      .from(statuses).orderBy(asc(statuses.position)),
    db.select({ id: ticketTypes.id, name: ticketTypes.name }).from(ticketTypes).orderBy(asc(ticketTypes.position)),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.isArchived, false)).orderBy(asc(projects.name)),
  ]);

  // Agrupar tickets pelo status_id real (colunas dinâmicas)
  const initialItems: Record<string, ReturnType<typeof mapTicket>[]> = {};
  for (const s of statusRows) {
    initialItems[s.id] = [];
  }
  for (const ticket of rows) {
    const colId = ticket.status_id;
    if (colId && initialItems[colId]) {
      initialItems[colId].push(mapTicket(ticket));
    } else if (statusRows.length > 0) {
      initialItems[statusRows[0].id].push(mapTicket(ticket));
    }
  }

  // Montar mapa de WIP limits por status_id
  const wipLimits: Record<string, number | null> = {};
  for (const s of statusRows) {
    if (s.wip_limit) wipLimits[s.id] = s.wip_limit;
  }

  // Montar colunas para o KanbanBoard
  const boardColumns = statusRows.map((s) => ({
    id: s.id,
    title: s.name,
    color: s.color || '#6b7280',
    isDone: s.is_done ?? false,
  }));

  // Hide project filter when already filtering by board/project
  const projectsToShow = (board_id || project_id) ? [] : projectRows;

  return (
    <BoardShell services={serviceRows} statuses={statusRows} ticketTypes={typeRows}>
      <KanbanBoard initialItems={initialItems} columns={boardColumns} wipLimits={wipLimits} availableProjects={projectsToShow} />
    </BoardShell>
  );
}
