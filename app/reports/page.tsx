export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ReportsView from '@/components/reports/ReportsView';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { requireAdmin } from '@/lib/page-guards';
import type { ProjectRow } from '@/lib/types/db-rows';

export default async function ReportsPage() {
  await requireAdmin();
  const wsId = await getDefaultWorkspaceId();
  const projects = await query<ProjectRow>(
    `SELECT id, name, color FROM projects WHERE workspace_id = $1 AND is_archived = false ORDER BY name`,
    [wsId]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <ReportsView projects={projects.rows} />
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
