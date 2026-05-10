export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import ApprovalGate from '@/components/ui/ApprovalGate';
import { requireApproved } from '@/lib/page-guards';
import { isAdmin } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { query } from '@/lib/db';
import ProjectSpecEditor, {
  type SpecBacklink,
} from '@/components/projects/ProjectSpecEditor';

interface PageProps {
  params: { id: string };
}

interface ProjectRow {
  id: string;
  name: string;
  prefix: string;
  is_archived: boolean;
}

interface SpecRow {
  content_html: string;
  content_text: string;
  version: number;
  updated_at: string | null;
  updated_by_name: string | null;
}

export default async function ProjectSpecPage({ params }: PageProps) {
  const auth = await requireApproved();

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

  // Se a row não existe ainda, tratamos como spec vazio (version=0). O primeiro
  // PUT vai criar a row com INSERT ON CONFLICT.
  const specRes = await query<SpecRow>(
    `SELECT
       ps.content_html,
       ps.content_text,
       ps.version,
       ps.updated_at,
       m.display_name AS updated_by_name
     FROM project_specs ps
     LEFT JOIN members m ON m.id = ps.updated_by
     WHERE ps.project_id = $1`,
    [params.id],
  );
  const spec = specRes.rows[0] ?? {
    content_html: '',
    content_text: '',
    version: 0,
    updated_at: null,
    updated_by_name: null,
  };

  const backlinksRes = await query<SpecBacklink>(
    `SELECT
       tf.id AS ticket_id,
       tf.ticket_key,
       tf.title,
       tf.status_name,
       tf.status_color,
       tf.is_done
     FROM project_spec_backlinks b
     JOIN tickets_full tf ON tf.id = b.target_ticket_id
     WHERE b.source_project_id = $1
     ORDER BY tf.ticket_key ASC`,
    [params.id],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <ApprovalGate>
            <div className="mx-auto max-w-[1180px]">
              <ProjectSpecEditor
                projectId={project.id}
                projectName={project.name}
                projectPrefix={project.prefix}
                projectArchived={project.is_archived}
                initialSpec={{
                  contentHtml: spec.content_html,
                  contentText: spec.content_text,
                  version: spec.version,
                  updatedAt: spec.updated_at,
                  updatedByName: spec.updated_by_name,
                }}
                initialBacklinks={backlinksRes.rows}
                isAdmin={isAdmin(auth.role)}
              />
            </div>
          </ApprovalGate>
        </main>
      </div>
    </div>
  );
}
