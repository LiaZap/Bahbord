export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import PersonalTicketList from '@/components/personal/PersonalTicketList';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export default async function ThisWeekPage() {
  const auth = await getAuthMember();
  const memberId = auth?.id;

  let tickets: any[] = [];
  if (memberId) {
    // Tickets do user com prazo nesta semana (segunda a domingo)
    const result = await query(
      `SELECT
        t.id, t.ticket_key, t.title, t.priority,
        t.status_name, t.status_color,
        t.type_name, t.type_icon, t.type_color,
        t.assignee_name, t.due_date, t.completed_at,
        t.project_id, t.project_name, t.project_color, t.project_prefix,
        t.updated_at
       FROM tickets_full t
       WHERE t.assignee_id = $1
         AND t.is_archived = false
         AND t.is_done = false
         AND t.due_date IS NOT NULL
         AND t.due_date >= date_trunc('week', NOW())
         AND t.due_date < date_trunc('week', NOW()) + INTERVAL '7 days'
       ORDER BY t.due_date ASC, t.priority ASC
       LIMIT 100`,
      [memberId]
    );
    tickets = result.rows;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <div className="mx-auto max-w-[1100px] space-y-8">
              <div className="space-y-2">
                <p className="page-eyebrow">Workspace · Esta semana</p>
                <h1 className="page-title">
                  Esta semana <span className="em">— o que precisa entregar.</span>
                </h1>
                <p className="text-[13px] text-secondary">
                  {tickets.length === 0
                    ? 'Nada com prazo essa semana atribuído a você.'
                    : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} com prazo até domingo.`}
                </p>
              </div>

              <PersonalTicketList
                tickets={tickets}
                emptyMessage="Nenhum ticket com prazo nesta semana."
              />
            </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
