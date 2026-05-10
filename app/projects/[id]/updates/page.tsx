export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { requireApproved } from '@/lib/page-guards';
import { isAdmin } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { query } from '@/lib/db';
import ProjectUpdatesList, {
  type ProjectUpdate,
} from '@/components/projects/ProjectUpdatesList';

interface PageProps {
  params: { id: string };
}

interface ProjectRow {
  id: string;
  name: string;
  prefix: string;
  is_archived: boolean;
}

export default async function ProjectUpdatesPage({ params }: PageProps) {
  const auth = await requireApproved();

  // Buscar projeto + verificar acesso. Layout pai já força admin, mas mantemos
  // a checagem para o caso do guard mudar no futuro.
  const projectRes = await query<ProjectRow>(
    `SELECT id, name, prefix, is_archived
     FROM projects
     WHERE id = $1`,
    [params.id],
  );
  const project = projectRes.rows[0];
  if (!project) notFound();

  const canAccess = await hasProjectAccess(auth, params.id);
  if (!canAccess) notFound();

  // Carregar updates iniciais (server-side, evita flash de loading).
  const updatesRes = await query<ProjectUpdate>(
    `SELECT
       pu.id, pu.project_id, pu.workspace_id,
       pu.period_from, pu.period_to,
       pu.ai_summary, pu.pm_notes,
       pu.generated_at, pu.generated_by_cron,
       pu.pm_completed_at, pu.pm_completed_by,
       m.display_name AS pm_completed_by_name
     FROM project_updates pu
     LEFT JOIN members m ON m.id = pu.pm_completed_by
     WHERE pu.project_id = $1
     ORDER BY pu.period_to DESC, pu.generated_at DESC`,
    [params.id],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <div className="mx-auto max-w-[960px]">
              <ProjectUpdatesList
                projectId={project.id}
                projectName={project.name}
                projectPrefix={project.prefix}
                initialUpdates={updatesRes.rows}
                currentUserIsAdmin={isAdmin(auth.role)}
              />
            </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
