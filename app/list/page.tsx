import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ListView from '@/components/list/ListView';
import { query } from '@/lib/db';

export default async function ListPage() {
  const [ticketsResult, statusesResult, membersResult] = await Promise.all([
    query(`
      SELECT
        ticket_key, id, title, priority, status_name, status_color, status_id,
        service_name, service_color, assignee_name, assignee_id, type_icon, type_name,
        to_char(due_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS due,
        to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS created
      FROM tickets_full
      WHERE is_archived = false
      ORDER BY created_at DESC
    `),
    query(`SELECT id, name FROM statuses ORDER BY position ASC`),
    query(`SELECT id, display_name FROM members ORDER BY display_name ASC`),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-[#c5c8c6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <ListView
            tickets={ticketsResult.rows as any[]}
            statuses={statusesResult.rows as any[]}
            members={membersResult.rows as any[]}
          />
        </main>
      </div>
    </div>
  );
}
