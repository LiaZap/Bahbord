import { auth, currentUser } from '@clerk/nextjs/server';
import { query } from './db';

export interface AuthMember {
  id: string;
  clerk_id: string;
  workspace_id: string;
  role: string;
  display_name: string;
  email: string;
  is_approved: boolean;
}

/**
 * Get the authenticated member from Clerk + database.
 *
 * Flow:
 * 1. Clerk validates the session (JWT)
 * 2. We look up the member by clerk_user_id in our DB
 * 3. If member doesn't exist yet, auto-create (first login = pending approval)
 *
 * Returns null if not authenticated.
 */
export async function getAuthMember(): Promise<AuthMember | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    // Look up member by Clerk user ID
    const result = await query<AuthMember>(
      `SELECT m.id, m.workspace_id, m.display_name, m.email, m.is_approved,
        COALESCE(orr.role, 'viewer') AS role
      FROM members m
      LEFT JOIN org_roles orr ON orr.member_id = m.id AND orr.workspace_id = m.workspace_id
      WHERE m.clerk_user_id = $1`,
      [userId]
    );

    if (result.rows[0]) {
      return { ...result.rows[0], clerk_id: userId };
    }

    // Member doesn't exist — auto-create on first login
    const user = await currentUser();
    if (!user) return null;

    const wsResult = await query(`SELECT id FROM workspaces LIMIT 1`);
    const workspaceId = wsResult.rows[0]?.id;
    if (!workspaceId) return null;

    const displayName = user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress || 'Novo Membro';
    const email = user.emailAddresses[0]?.emailAddress || '';

    // First try to find by email (member may exist from manual creation)
    const existingByEmail = await query<{ id: string }>(
      `UPDATE members SET clerk_user_id = $1 WHERE email = $2 AND clerk_user_id IS NULL RETURNING id`,
      [userId, email]
    );

    if (existingByEmail.rows[0]) {
      const memberData = await query<AuthMember>(
        `SELECT m.id, m.workspace_id, m.display_name, m.email, COALESCE(orr.role, 'viewer') AS role
         FROM members m LEFT JOIN org_roles orr ON orr.member_id = m.id AND orr.workspace_id = m.workspace_id
         WHERE m.id = $1`, [existingByEmail.rows[0].id]
      );
      if (memberData.rows[0]) return { ...memberData.rows[0], clerk_id: userId };
    }

    // Create new member
    const newMember = await query<{ id: string }>(
      `INSERT INTO members (workspace_id, user_id, clerk_user_id, display_name, email, role, is_approved)
       VALUES ($1, gen_random_uuid(), $2, $3, $4, 'member', false)
       RETURNING id`,
      [workspaceId, userId, displayName, email]
    );

    if (!newMember.rows[0]) return null;

    // Create approval request for org access
    await query(
      `INSERT INTO approval_requests (workspace_id, requester_id, type, request_data)
       VALUES ($1, $2, 'org_access', $3)
       ON CONFLICT DO NOTHING`,
      [workspaceId, newMember.rows[0].id, JSON.stringify({ name: displayName, email })]
    );

    return {
      id: newMember.rows[0].id,
      clerk_id: userId,
      workspace_id: workspaceId,
      role: 'viewer',
      display_name: displayName,
      email,
      is_approved: false,
    };
  } catch {
    return null;
  }
}

export function isAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
}
