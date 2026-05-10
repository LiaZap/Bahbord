export const dynamic = 'force-dynamic';

import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { requireApproved } from '@/lib/page-guards';
import { isAdmin } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { computeInitiativeProgress } from '@/lib/initiatives';
import RoadmapView, {
  type RoadmapInitiative,
  type RoadmapProject,
  type RoadmapMember,
} from '@/components/roadmap/RoadmapView';

interface InitiativeRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  health: string;
  health_set_at: string | null;
  health_set_by: string | null;
  health_note: string | null;
  start_date: string | null;
  target_date: string | null;
  color: string | null;
  icon: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
}

interface InitiativeProjectRow {
  initiative_id: string;
  project_id: string;
  project_name: string;
  project_prefix: string;
  project_color: string | null;
}

interface ProjectListRow {
  id: string;
  name: string;
  prefix: string;
  color: string | null;
}

interface MemberRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export default async function RoadmapPage() {
  const auth = await requireApproved();
  const workspaceId = auth.workspace_id;

  // Carrega initiatives ativas (sem archived/completed por padrão).
  // Ordenação: severidade health (off_track > at_risk > on_track), depois target_date asc.
  const initiativesRes = await query<InitiativeRow>(
    `SELECT
       i.id, i.workspace_id, i.name, i.description, i.goal,
       i.health, i.health_set_at, i.health_set_by, i.health_note,
       i.start_date, i.target_date, i.color, i.icon,
       i.owner_id, m.display_name AS owner_name,
       i.created_at, i.updated_at
     FROM initiatives i
     LEFT JOIN members m ON m.id = i.owner_id
     WHERE i.workspace_id = $1
       AND i.health NOT IN ('archived', 'completed')
     ORDER BY
       CASE i.health
         WHEN 'off_track' THEN 0
         WHEN 'at_risk' THEN 1
         WHEN 'on_track' THEN 2
         WHEN 'completed' THEN 3
         WHEN 'archived' THEN 4
       END,
       i.target_date ASC NULLS LAST,
       i.name ASC`,
    [workspaceId],
  );

  const initiativeIds = initiativesRes.rows.map((r) => r.id);

  // Pre-fetch dos projects vinculados em uma única query pra evitar N+1.
  let initiativeProjects: InitiativeProjectRow[] = [];
  if (initiativeIds.length > 0) {
    const ipRes = await query<InitiativeProjectRow>(
      `SELECT
         ip.initiative_id,
         p.id AS project_id,
         p.name AS project_name,
         p.prefix AS project_prefix,
         p.color AS project_color
       FROM initiative_projects ip
       JOIN projects p ON p.id = ip.project_id
       WHERE ip.initiative_id = ANY($1::uuid[])
       ORDER BY ip.added_at ASC`,
      [initiativeIds],
    );
    initiativeProjects = ipRes.rows;
  }

  // Calcula progress em paralelo. MVP: <50 initiatives ativas.
  const enriched: RoadmapInitiative[] = await Promise.all(
    initiativesRes.rows.map(async (row) => {
      const progress = await computeInitiativeProgress(row.id);
      const projects = initiativeProjects
        .filter((ip) => ip.initiative_id === row.id)
        .map((ip) => ({
          project_id: ip.project_id,
          name: ip.project_name,
          prefix: ip.project_prefix,
          color: ip.project_color,
        }));
      return { ...row, progress, projects };
    }),
  );

  // Lista de projects do workspace pro picker do modal.
  const projectsRes = await query<ProjectListRow>(
    `SELECT id, name, prefix, color
     FROM projects
     WHERE workspace_id = $1 AND is_archived = false
     ORDER BY name ASC`,
    [workspaceId],
  );

  // Lista de members pro select de owner. Apenas aprovados.
  const membersRes = await query<MemberRow>(
    `SELECT id, display_name, avatar_url
     FROM members
     WHERE workspace_id = $1 AND COALESCE(is_approved, true) = true
     ORDER BY display_name ASC`,
    [workspaceId],
  );

  const projects: RoadmapProject[] = projectsRes.rows;
  const members: RoadmapMember[] = membersRes.rows;

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <RoadmapView
              initialInitiatives={enriched}
              projects={projects}
              members={members}
              isAdmin={isAdmin(auth.role)}
              currentMemberId={auth.id}
            />
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
