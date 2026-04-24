import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';

interface SyncSummary {
  total_clerk_users: number;
  created: number;
  linked_by_email: number;
  updated: number;
  errors: Array<{ clerk_id: string; error: string }>;
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const autoApprove = body.auto_approve === true;

    const workspaceId = await getDefaultWorkspaceId();
    const client = await clerkClient();

    // Page through all Clerk users (max 500 per page)
    const all: Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      avatar_url: string | null;
    }> = [];

    let offset = 0;
    const pageSize = 100;
    while (true) {
      const page = await client.users.getUserList({ limit: pageSize, offset });
      const items = page.data.map((u) => ({
        id: u.id,
        first_name: u.firstName,
        last_name: u.lastName,
        email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || null,
        avatar_url: u.imageUrl || null,
      }));
      all.push(...items);
      if (page.data.length < pageSize) break;
      offset += pageSize;
      if (offset > 5000) break; // safety cap
    }

    const summary: SyncSummary = {
      total_clerk_users: all.length,
      created: 0,
      linked_by_email: 0,
      updated: 0,
      errors: [],
    };

    for (const u of all) {
      try {
        const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Usuário';
        const email = u.email || '';

        // Already linked by clerk_user_id?
        const existing = await query<{ id: string }>(
          `SELECT id FROM members WHERE clerk_user_id = $1`, [u.id]
        );

        if (existing.rows[0]) {
          await query(
            `UPDATE members
             SET display_name = $1,
                 email = $2,
                 avatar_url = COALESCE($3, avatar_url),
                 is_approved = CASE WHEN $4 THEN true ELSE is_approved END
             WHERE clerk_user_id = $5`,
            [displayName, email, u.avatar_url, autoApprove, u.id]
          );
          summary.updated += 1;
          continue;
        }

        // Try to link by email
        if (email) {
          const linked = await query<{ id: string }>(
            `UPDATE members
             SET clerk_user_id = $1,
                 display_name = $2,
                 avatar_url = COALESCE($3, avatar_url),
                 is_approved = CASE WHEN $4 THEN true ELSE is_approved END
             WHERE email = $5 AND clerk_user_id IS NULL RETURNING id`,
            [u.id, displayName, u.avatar_url, autoApprove, email]
          );
          if (linked.rows[0]) {
            summary.linked_by_email += 1;
            continue;
          }
        }

        // Create new member
        const created = await query<{ id: string }>(
          `INSERT INTO members (workspace_id, user_id, clerk_user_id, display_name, email, avatar_url, role, is_approved)
           VALUES ($1, gen_random_uuid(), $2, $3, $4, $5, 'member', $6)
           RETURNING id`,
          [workspaceId, u.id, displayName, email, u.avatar_url, autoApprove]
        );

        if (created.rows[0] && !autoApprove) {
          // Create approval request so admin sees the new user
          await query(
            `INSERT INTO approval_requests (workspace_id, requester_id, type, request_data)
             VALUES ($1, $2, 'org_access', $3)
             ON CONFLICT DO NOTHING`,
            [workspaceId, created.rows[0].id, JSON.stringify({ name: displayName, email })]
          );
        }
        summary.created += 1;
      } catch (e) {
        summary.errors.push({ clerk_id: u.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return NextResponse.json(summary);
  } catch (err) {
    console.error('POST /api/members/sync-clerk error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
