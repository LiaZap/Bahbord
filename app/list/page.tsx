export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ViewTabsWrapper from '@/components/layout/ViewTabsWrapper';
import ListView from '@/components/list/ListView';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

export default async function ListPage() {
  const auth = await getAuthMember();
  const userIsAdmin = auth ? isAdmin(auth.role) : false;

  let ticketWhere = 'WHERE is_archived = false';
  const ticketParams: string[] = [];

  if (auth && !userIsAdmin) {
    ticketParams.push(auth.id);
    ticketWhere = `WHERE is_archived = false AND board_id IN (SELECT board_id FROM board_roles WHERE member_id = $1)`;
  }

  const [ticketsResult, statusesResult, membersResult] = await Promise.all([
    query(`
      SELECT
        ticket_key, id, title, priority, status_name, status_color, status_id,
        service_name, service_color, assignee_name, assignee_id, type_icon, type_name,
        to_char(due_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS due,
        to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS created
      FROM tickets_full
      ${ticketWhere}
      ORDER BY created_at DESC
    `, ticketParams.length > 0 ? ticketParams : undefined),
    query(`SELECT id, name FROM statuses ORDER BY position ASC`),
    query(`SELECT id, display_name FROM members ORDER BY display_name ASC`),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <ViewTabsWrapper />
        <main className="flex-1 overflow-auto">
          <ApprovalGate>
            <ListView
              tickets={ticketsResult.rows as any[]}
              statuses={statusesResult.rows as any[]}
              members={membersResult.rows as any[]}
            />
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
