export const dynamic = "force-dynamic";
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import WorkloadView from '@/components/reports/WorkloadView';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { requireApproved } from '@/lib/page-guards';

interface WorkloadProject {
  id: string;
  name: string;
  color: string | null;
}

export default async function WorkloadPage() {
  await requireApproved();
  const wsId = await getDefaultWorkspaceId();
  const projects = await query<WorkloadProject>(
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
            <WorkloadView projects={projects.rows} />
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
