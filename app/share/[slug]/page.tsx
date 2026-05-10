export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { hashSharePassword } from '@/lib/share-links';
import PasswordPrompt from '@/components/public/PasswordPrompt';
import PublicClientDashboard from '@/components/public/PublicClientDashboard';
import type { TicketRow, ShareDashboardStats } from '@/lib/types/db-rows';

interface ShareLinkRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  board_id: string | null;
  slug: string;
  password_hash: string | null;
  expires_at: string | null;
  views_count: number;
  project_name: string | null;
  project_color: string | null;
}

function InvalidState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="card-premium w-full max-w-sm p-8 text-center">
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="mt-2 text-[12px] text-slate-500">{message}</p>
        <p className="mt-6 text-[10px] uppercase tracking-wider text-slate-600">
          Powered by Bah!Flow
        </p>
      </div>
    </div>
  );
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { auth?: string };
}) {
  const { slug } = params;
  const providedAuth = searchParams?.auth;

  const linkRes = await query<ShareLinkRow>(
    `SELECT sl.*, p.name AS project_name, p.color AS project_color
     FROM share_links sl
     LEFT JOIN projects p ON p.id = sl.project_id
     WHERE sl.slug = $1
     LIMIT 1`,
    [slug]
  );

  const link = linkRes.rows[0];

  if (!link) {
    return (
      <InvalidState
        title="Link não encontrado"
        message="O link que você tentou acessar não existe ou foi removido."
      />
    );
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return (
      <InvalidState
        title="Link expirado"
        message="Este link não está mais disponível. Solicite um novo ao administrador."
      />
    );
  }

  if (link.password_hash) {
    if (!providedAuth) {
      return <PasswordPrompt slug={slug} />;
    }
    if (hashSharePassword(providedAuth) !== link.password_hash) {
      return <PasswordPrompt slug={slug} error />;
    }
  }

  // Increment view count (fire-and-forget)
  query(`UPDATE share_links SET views_count = views_count + 1 WHERE id = $1`, [link.id]).catch(
    (err) => console.error('share views_count update error:', err)
  );

  // Build filter for tickets
  const filters: string[] = [`is_archived = false`];
  const params_: unknown[] = [];
  if (link.project_id) {
    params_.push(link.project_id);
    filters.push(`project_id = $${params_.length}`);
  } else if (link.board_id) {
    params_.push(link.board_id);
    filters.push(`board_id = $${params_.length}`);
  } else {
    // No scope: nothing to show safely
    return (
      <InvalidState
        title="Link inválido"
        message="Este link não está associado a um projeto ou board."
      />
    );
  }

  const whereClause = filters.join(' AND ');

  const [ticketsRes, statsRes] = await Promise.all([
    query<TicketRow>(
      `SELECT ticket_key, id, title, priority, status_name, status_color, type_name, type_icon, is_done
       FROM tickets_full
       WHERE ${whereClause}
       ORDER BY updated_at DESC
       LIMIT 50`,
      params_
    ),
    query<ShareDashboardStats>(
      `SELECT
         COUNT(*) FILTER (WHERE is_done = false)::int AS total_active,
         COUNT(*) FILTER (
           WHERE is_done = false
             AND (
               UPPER(COALESCE(status_name,'')) LIKE '%PROGRESS%'
               OR UPPER(COALESCE(status_name,'')) LIKE '%ANDAMENTO%'
             )
         )::int AS in_progress,
         COUNT(*) FILTER (WHERE is_done = true AND completed_at > NOW() - INTERVAL '30 days')::int AS completed_month
       FROM tickets_full
       WHERE ${whereClause}`,
      params_
    ),
  ]);

  const stats: ShareDashboardStats = statsRes.rows[0] ?? { total_active: 0, in_progress: 0, completed_month: 0 };

  return (
    <PublicClientDashboard
      link={{
        id: link.id,
        slug: link.slug,
        project_id: link.project_id,
        board_id: link.board_id,
        project_name: link.project_name,
        project_color: link.project_color,
        expires_at: link.expires_at,
        views_count: link.views_count,
      }}
      tickets={ticketsRes.rows as unknown as React.ComponentProps<typeof PublicClientDashboard>['tickets']}
      stats={stats}
    />
  );
}
