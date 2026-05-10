export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ViewTabsWrapper from '@/components/layout/ViewTabsWrapper';
import CalendarView from '@/components/calendar/CalendarView';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { requireApproved } from '@/lib/page-guards';
import type { TicketRow, SprintRow } from '@/lib/types/db-rows';

interface CalendarSearchParams {
  board_id?: string;
  month?: string; // YYYY-MM
  assignee_id?: string;
}

function parseMonth(month?: string): { year: number; monthIdx: number } {
  // monthIdx 0-based to be coherent with JS Date
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map((s) => parseInt(s, 10));
    if (m >= 1 && m <= 12) return { year: y, monthIdx: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIdx: now.getMonth() };
}

function pad(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<CalendarSearchParams>;
}) {
  await requireApproved();
  const params = await searchParams;
  const { board_id, month, assignee_id } = params;
  const wsId = await getDefaultWorkspaceId();

  const { year, monthIdx } = parseMonth(month);
  // First day of month and first day of next month (UTC-safe ISO strings)
  const firstDay = `${year}-${pad(monthIdx + 1)}-01`;
  const nextMonthYear = monthIdx === 11 ? year + 1 : year;
  const nextMonthIdx = monthIdx === 11 ? 0 : monthIdx + 1;
  const firstNextMonth = `${nextMonthYear}-${pad(nextMonthIdx + 1)}-01`;

  // Build dynamic WHERE for tickets
  const ticketParams: string[] = [firstDay, firstNextMonth];
  let ticketWhere = `WHERE is_archived = false
    AND due_date IS NOT NULL
    AND due_date >= $1::date
    AND due_date < $2::date`;
  if (board_id) {
    ticketParams.push(board_id);
    ticketWhere += ` AND board_id = $${ticketParams.length}`;
  }
  if (assignee_id) {
    ticketParams.push(assignee_id);
    ticketWhere += ` AND assignee_id = $${ticketParams.length}`;
  }

  // Sprints overlapping the month
  const sprintParams: string[] = [wsId, firstDay, firstNextMonth];
  let sprintQuery = `
    SELECT id, name, start_date::text, end_date::text, is_active, is_completed, project_id
    FROM sprints
    WHERE workspace_id = $1
      AND start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND start_date < $3::date
      AND end_date >= $2::date
    ORDER BY start_date ASC, name ASC
  `;

  let tickets: TicketRow[] = [];
  let sprints: SprintRow[] = [];
  let queryError: string | null = null;
  try {
    const [tRes, sRes] = await Promise.all([
      query<TicketRow>(
        `SELECT
          id, ticket_key, title, priority, type_icon,
          status_name, status_color, is_done,
          service_name, service_color,
          assignee_id, assignee_name,
          sprint_id, sprint_name,
          due_date::text,
          project_id, project_name, project_prefix
         FROM tickets_full
         ${ticketWhere}
         ORDER BY due_date ASC, priority ASC NULLS LAST`,
        ticketParams
      ),
      query<SprintRow>(sprintQuery, sprintParams),
    ]);
    tickets = tRes.rows;
    sprints = sRes.rows;
  } catch (err) {
    queryError = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('calendar query error:', err);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <ViewTabsWrapper />
        <main className="flex-1 overflow-auto">
          {queryError ? (
            <div className="m-6 card-premium border-red-500/30 bg-red-500/5 p-4">
              <p className="text-[13px] font-medium text-red-400">Não consegui carregar o calendário</p>
              <p className="mt-1 text-[12px] text-red-300/80 font-mono">{queryError}</p>
            </div>
          ) : (
            <CalendarView
              year={year}
              monthIdx={monthIdx}
              tickets={tickets as unknown as React.ComponentProps<typeof CalendarView>['tickets']}
              sprints={sprints as unknown as React.ComponentProps<typeof CalendarView>['sprints']}
              boardId={board_id ?? null}
              assigneeId={assignee_id ?? null}
            />
          )}
        </main>
      </div>
    </div>
  );
}
