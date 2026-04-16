export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BoardsListing from '@/components/boards/BoardsListing';
import { query } from '@/lib/db';

type BoardRow = {
  id: string;
  name: string;
  type: string;
  project_id: string;
  project_name: string;
  project_color: string;
  project_prefix: string;
  ticket_count: number;
};

export default async function BoardsPage() {
  const result = await query<BoardRow>(
    `SELECT
      b.id, b.name, b.type, b.project_id,
      p.name AS project_name, p.color AS project_color, p.prefix AS project_prefix,
      (SELECT COUNT(*) FROM tickets t WHERE t.board_id = b.id)::int AS ticket_count
    FROM boards b
    JOIN projects p ON p.id = b.project_id
    WHERE p.is_archived = false
    ORDER BY p.name ASC, b.name ASC`
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-5">
          <BoardsListing boards={result.rows} />
        </main>
      </div>
    </div>
  );
}
