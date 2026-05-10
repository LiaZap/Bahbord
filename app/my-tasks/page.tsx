export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import PersonalTicketList from '@/components/personal/PersonalTicketList';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query } from '@/lib/db';
import { requireApproved } from '@/lib/page-guards';

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ show_snoozed?: string }> | { show_snoozed?: string };
}) {
  const auth = await requireApproved();
  const memberId = auth?.id;
  // Next 15 entrega searchParams como Promise — ambos os formatos suportados.
  const sp = await Promise.resolve(searchParams);
  const showSnoozed = sp?.show_snoozed === 'true';

  let tickets: any[] = [];
  let queryError: string | null = null;
  if (memberId) {
    try {
      const snoozeFilter = showSnoozed
        ? `AND (t.snoozed_until IS NOT NULL AND t.snoozed_until > NOW())`
        : `AND (t.snoozed_until IS NULL OR t.snoozed_until <= NOW())`;
      const result = await query(
        `SELECT
          t.id, t.ticket_key, t.title, t.priority,
          t.status_name, t.status_color,
          t.type_name, t.type_icon, t.type_color,
          t.assignee_name, t.due_date, t.completed_at,
          t.snoozed_until,
          t.project_id, t.project_name, t.project_prefix,
          p.color AS project_color,
          t.updated_at
         FROM tickets_full t
         LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.assignee_id = $1
           AND t.is_archived = false
           AND t.is_done = false
           ${snoozeFilter}
         ORDER BY
           CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           t.due_date ASC NULLS LAST,
           t.updated_at DESC
         LIMIT 100`,
        [memberId]
      );
      tickets = result.rows;
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('my-tasks query error:', err);
    }
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

              {queryError ? (
                <div className="card-premium border-red-500/30 bg-red-500/5 p-4">
                  <p className="text-[13px] font-medium text-red-400">Não consegui carregar suas tarefas</p>
                  <p className="mt-1 text-[12px] text-red-300/80 font-mono">{queryError}</p>
                  <p className="mt-2 text-[11px] text-secondary">
                    Provavelmente uma migration está faltando. Rode o SQL em <code className="font-mono">db/036_view_project_color.sql</code> no banco.
                  </p>
                </div>
              ) : (
                <PersonalTicketList
                  tickets={tickets}
                  emptyMessage={
                    showSnoozed
                      ? 'Nenhum ticket snoozed no momento.'
                      : 'Você está em dia. Nenhum ticket atribuído.'
                  }
                  showSnoozed={showSnoozed}
                />
              )}
            </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
