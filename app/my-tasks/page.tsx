export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import PersonalTicketList from '@/components/personal/PersonalTicketList';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export default async function MyTasksPage() {
  const auth = await getAuthMember();
  const memberId = auth?.id;

  let tickets: any[] = [];
  if (memberId) {
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
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         t.due_date ASC NULLS LAST,
         t.updated_at DESC
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
                <p className="page-eyebrow">Workspace · {auth?.display_name || 'Você'}</p>
                <h1 className="page-title">
                  Minhas tarefas <span className="em">— o que está com você.</span>
                </h1>
                <p className="text-[13px] text-secondary">
                  {tickets.length === 0
                    ? 'Nada atribuído a você no momento. Tudo limpo.'
                    : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} ativo${tickets.length === 1 ? '' : 's'}.`}
                </p>
              </div>

              <PersonalTicketList tickets={tickets} emptyMessage="Você está em dia. Nenhum ticket atribuído." />
            </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
