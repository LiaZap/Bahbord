import { cookies } from 'next/headers';
import { query } from './db';

export async function getAuthMember(): Promise<{ id: string; workspace_id: string; role: string } | null> {
  const cookieStore = await cookies();
  const memberId = cookieStore.get('bahjira-member-id')?.value;
  const workspaceId = cookieStore.get('bahjira-workspace-id')?.value;

  if (!memberId || !workspaceId) return null;

  const result = await query<{ id: string; workspace_id: string; role: string }>(
    `SELECT m.id, m.workspace_id, COALESCE(orr.role, 'viewer') AS role
     FROM members m
     LEFT JOIN org_roles orr ON orr.member_id = m.id AND orr.workspace_id = $2
     WHERE m.id = $1`,
    [memberId, workspaceId]
  );

  return result.rows[0] || null;
}

export function isAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
}
