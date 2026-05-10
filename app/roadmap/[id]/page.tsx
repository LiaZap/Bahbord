export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { requireApproved } from '@/lib/page-guards';
import { isAdmin } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { computeInitiativeProgress } from '@/lib/initiatives';
import InitiativeDetail, {
  type DetailInitiative,
  type DetailProjectBreakdown,
  type DetailHealthEvent,
  type DetailMember,
  type DetailProject,
} from '@/components/roadmap/InitiativeDetail';

interface PageProps {
  params: { id: string };
}

interface InitiativeRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  health: string;
  health_set_at: string | null;
  health_set_by: string | null;
  health_set_by_name: string | null;
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

interface ProjectBreakdownRow {
  project_id: string;
  name: string;
  prefix: string;
  color: string | null;
  is_archived: boolean;
  weight: number;
  ticket_count: number;
  completed_count: number;
}

interface HealthHistoryRow {
  created_at: string;
  actor_name: string | null;
  changes: Record<string, unknown>;
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

export default async function InitiativeDetailPage({ params }: PageProps) {
  const auth = await requireApproved();

  const initRes = await query<InitiativeRow>(
    `SELECT
       i.id, i.workspace_id, i.name, i.description, i.goal,
       i.health, i.health_set_at, i.health_set_by,
       hsb.display_name AS health_set_by_name,
       i.health_note,
       i.start_date, i.target_date, i.color, i.icon,
       i.owner_id, own.display_name AS owner_name,
       i.created_at, i.updated_at
     FROM initiatives i
     LEFT JOIN members own ON own.id = i.owner_id
     LEFT JOIN members hsb ON hsb.id = i.health_set_by
     WHERE i.id = $1`,
    [params.id],
  );

  const initiative = initRes.rows[0];
  if (!initiative) notFound();
  if (initiative.workspace_id !== auth.workspace_id) notFound();

  const projectsRes = await query<ProjectBreakdownRow>(
    `SELECT
       p.id AS project_id,
       p.name,
       p.prefix,
       p.color,
       p.is_archived,
       COALESCE(ip.weight, 1) AS weight,
       COUNT(t.id)::int AS ticket_count,
       COUNT(t.id) FILTER (WHERE COALESCE(s.is_done, false) = true)::int AS completed_count
     FROM initiative_projects ip
     JOIN projects p ON p.id = ip.project_id
     LEFT JOIN tickets t ON t.project_id = p.id
     LEFT JOIN statuses s ON s.id = t.status_id
     WHERE ip.initiative_id = $1
     GROUP BY p.id, p.name, p.prefix, p.color, p.is_archived, ip.weight, ip.added_at
     ORDER BY ip.added_at ASC`,
    [params.id],
  );

  const projects: DetailProjectBreakdown[] = projectsRes.rows.map((r) => ({
    project_id: r.project_id,
    name: r.name,
    prefix: r.prefix,
    color: r.color,
    is_archived: r.is_archived,
    weight: Number(r.weight),
    ticket_count: Number(r.ticket_count),
    completed_count: Number(r.completed_count),
    percentage:
      Number(r.ticket_count) === 0
        ? 0
        : Math.round((Number(r.completed_count) / Number(r.ticket_count)) * 100),
  }));

  let healthHistory: DetailHealthEvent[] = [];
  try {
    const histRes = await query<HealthHistoryRow>(
      `SELECT al.created_at, m.display_name AS actor_name, al.changes
       FROM audit_log al
       LEFT JOIN members m ON m.id = al.actor_id
       WHERE al.entity_type = 'initiative'
         AND al.entity_id = $1
         AND al.action = 'initiative.health_changed'
       ORDER BY al.created_at DESC
       LIMIT 5`,
      [params.id],
    );
    healthHistory = histRes.rows.map((r) => ({
      created_at: r.created_at,
      actor_name: r.actor_name,
      from: typeof r.changes?.from === 'string' ? (r.changes.from as string) : null,
      to: typeof r.changes?.to === 'string' ? (r.changes.to as string) : null,
      note: typeof r.changes?.note === 'string' ? (r.changes.note as string) : null,
    }));
  } catch {
    healthHistory = [];
  }

  const progress = await computeInitiativeProgress(params.id);

  const allProjectsRes = await query<ProjectListRow>(
    `SELECT id, name, prefix, color
     FROM projects
     WHERE workspace_id = $1 AND is_archived = false
     ORDER BY name ASC`,
    [auth.workspace_id],
  );
  const allProjects: DetailProject[] = allProjectsRes.rows;

  const membersRes = await query<MemberRow>(
    `SELECT id, display_name, avatar_url
     FROM members
     WHERE workspace_id = $1 AND COALESCE(is_approved, true) = true
     ORDER BY display_name ASC`,
    [auth.workspace_id],
  );
  const members: DetailMember[] = membersRes.rows;

  const initiativeData: DetailInitiative = {
    ...initiative,
    progress,
    projects,
    health_history: healthHistory,
  };

  // Derivado: owner pode editar (não deletar). Apenas admin remove a initiative.
  const adminFlag = isAdmin(auth.role);
  const ownerFlag = initiative.owner_id === auth.id;

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <InitiativeDetail
              initiative={initiativeData}
              allProjects={allProjects}
              members={members}
              isAdmin={adminFlag}
              isOwner={ownerFlag}
            />
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
