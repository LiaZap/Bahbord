import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import TimelineView from '@/components/timeline/TimelineView';
import { query } from '@/lib/db';

export default async function TimelinePage() {
  const result = await query(`
    SELECT
      id, ticket_key, title, priority, type_icon,
      status_name, status_color,
      service_name, service_color,
      assignee_name,
      due_date::text,
      created_at::text,
      completed_at::text
    FROM tickets_full
    WHERE is_archived = false AND due_date IS NOT NULL
    ORDER BY due_date ASC
  `);

  return (
    <div className="flex h-screen overflow-hidden bg-[#1a1c1e] text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <TimelineView tickets={result.rows as any[]} />
        </main>
      </div>
    </div>
  );
}
