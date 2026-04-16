export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import TimelineView from '@/components/timeline/TimelineView';
import { query, getDefaultWorkspaceId } from '@/lib/db';

export default async function TimelinePage() {
  const wsId = await getDefaultWorkspaceId();

  const [ticketsResult, sprintsResult] = await Promise.all([
    query(`
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
      WHERE is_archived = false
        AND (due_date IS NOT NULL OR sprint_id IS NOT NULL)
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `),
    query(
      `SELECT id, name, start_date::text, end_date::text, is_active, is_completed
       FROM sprints
       WHERE workspace_id = $1
       ORDER BY start_date ASC NULLS LAST, created_at ASC`,
      [wsId]
    ),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-hidden">
          <TimelineView
            tickets={ticketsResult.rows as any[]}
            sprints={sprintsResult.rows as any[]}
          />
        </main>
      </div>
    </div>
  );
}
