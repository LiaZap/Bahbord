export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ViewTabsWrapper from '@/components/layout/ViewTabsWrapper';
import TimelineView from '@/components/timeline/TimelineView';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { requireAdmin } from '@/lib/page-guards';
import type { TicketRow, SprintRow } from '@/lib/types/db-rows';

export default async function TimelinePage({ searchParams }: { searchParams: { board_id?: string; project_id?: string } }) {
  await requireAdmin();
  const { board_id, project_id } = await searchParams;
  const wsId = await getDefaultWorkspaceId();

  // Resolve project_id from board_id if needed
  let resolvedProjectId = project_id;
  if (board_id && !resolvedProjectId) {
    const boardRes = await query(`SELECT project_id FROM boards WHERE id = $1`, [board_id]);
    resolvedProjectId = boardRes.rows[0]?.project_id;
  }

  // Build ticket query
  let ticketWhere = 'WHERE is_archived = false AND (due_date IS NOT NULL OR sprint_id IS NOT NULL)';
  const ticketParams: string[] = [];
  if (board_id) {
    ticketParams.push(board_id);
    ticketWhere = `WHERE is_archived = false AND board_id = $${ticketParams.length} AND (due_date IS NOT NULL OR sprint_id IS NOT NULL)`;
  } else if (resolvedProjectId) {
    ticketParams.push(resolvedProjectId);
    ticketWhere = `WHERE is_archived = false AND project_id = $${ticketParams.length} AND (due_date IS NOT NULL OR sprint_id IS NOT NULL)`;
  }

  // Build sprint query
  let sprintWhere = 'workspace_id = $1';
  const sprintParams: string[] = [wsId];
  if (resolvedProjectId) {
    sprintParams.push(resolvedProjectId);
    sprintWhere = `workspace_id = $1 AND project_id = $2`;
  }

  const [ticketsResult, sprintsResult] = await Promise.all([
    query<TicketRow>(`
      SELECT
        id, ticket_key, title, priority, type_icon,
        status_name, status_color, is_done,
        service_name, service_color,
        assignee_name,
        sprint_id, sprint_name,
        due_date::text,
        created_at::text,
        completed_at::text
      FROM tickets_full
      ${ticketWhere}
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `, ticketParams.length > 0 ? ticketParams : undefined),
    query<SprintRow>(
      `SELECT id, name, start_date::text, end_date::text, is_active, is_completed
       FROM sprints
       WHERE ${sprintWhere}
       ORDER BY start_date ASC NULLS LAST, created_at ASC`,
      sprintParams
    ),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <ViewTabsWrapper />
        <main className="flex-1 overflow-hidden">
          <TimelineView
            tickets={ticketsResult.rows as unknown as React.ComponentProps<typeof TimelineView>['tickets']}
            sprints={sprintsResult.rows as unknown as React.ComponentProps<typeof TimelineView>['sprints']}
          />
        </main>
      </div>
    </div>
  );
}
