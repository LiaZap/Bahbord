export const dynamic = "force-dynamic";
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ViewTabsWrapper from '@/components/layout/ViewTabsWrapper';
import ListView from '@/components/list/ListView';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';
import { isAdmin } from '@/lib/api-auth';
import { hasBoardAccess, hasProjectAccess } from '@/lib/access-check';
import { requireApproved } from '@/lib/page-guards';
import type { TicketRow, StatusRow, MemberRow } from '@/lib/types/db-rows';

export default async function ListPage({ searchParams }: { searchParams: { board_id?: string; project_id?: string } }) {
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

  let ticketWhere = 'WHERE is_archived = false';
  const ticketParams: string[] = [];

  if (board_id) {
    ticketParams.push(board_id);
    ticketWhere = `WHERE board_id = $${ticketParams.length} AND is_archived = false`;
  } else if (project_id) {
    ticketParams.push(project_id);
    ticketWhere = `WHERE project_id = $${ticketParams.length} AND is_archived = false`;
  } else if (auth && !userIsAdmin) {
    ticketParams.push(auth.id);
    ticketWhere = `WHERE is_archived = false AND board_id IN (SELECT board_id FROM board_roles WHERE member_id = $${ticketParams.length})`;
  }

  const [ticketsResult, statusesResult, membersResult] = await Promise.all([
    query<TicketRow>(`
      SELECT
        ticket_key, id, title, priority, status_name, status_color, status_id,
        service_name, service_color, assignee_name, assignee_id, type_icon, type_name,
        to_char(due_date AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS due,
        to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS created
      FROM tickets_full
      ${ticketWhere}
      ORDER BY created_at DESC
    `, ticketParams.length > 0 ? ticketParams : undefined),
    query<StatusRow>(`SELECT id, name FROM statuses ORDER BY position ASC`),
    query<MemberRow>(`SELECT id, display_name FROM members ORDER BY display_name ASC`),
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
              tickets={ticketsResult.rows as unknown as React.ComponentProps<typeof ListView>['tickets']}
              statuses={statusesResult.rows as React.ComponentProps<typeof ListView>['statuses']}
              members={membersResult.rows as unknown as React.ComponentProps<typeof ListView>['members']}
            />
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
