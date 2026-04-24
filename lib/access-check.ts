import { query } from './db';
import type { AuthMember } from './api-auth';

/**
 * Check if a member has access to a specific board.
 * Admins/owners always have access.
 * Others need: board_roles, project_roles (on the board's project), or org admin.
 */
export async function hasBoardAccess(auth: AuthMember | null, boardId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'owner' || auth.role === 'admin') return true;

  const result = await query(
    `SELECT 1 FROM boards b
     WHERE b.id = $1 AND (
       EXISTS (SELECT 1 FROM board_roles br WHERE br.board_id = b.id AND br.member_id = $2)
       OR EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = b.project_id AND pr.member_id = $2)
     )
     LIMIT 1`,
    [boardId, auth.id]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

/**
 * Check if a member has access to a specific project.
 * Admins/owners always have access.
 * Others need: project_roles on the project, or board_roles on any board of the project.
 */
export async function hasProjectAccess(auth: AuthMember | null, projectId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'owner' || auth.role === 'admin') return true;

  const result = await query(
    `SELECT 1 FROM projects p
     WHERE p.id = $1 AND (
       EXISTS (SELECT 1 FROM project_roles pr WHERE pr.project_id = p.id AND pr.member_id = $2)
       OR EXISTS (SELECT 1 FROM board_roles br JOIN boards b ON b.id = br.board_id WHERE b.project_id = p.id AND br.member_id = $2)
     )
     LIMIT 1`,
    [projectId, auth.id]
  );
  return result.rowCount ? result.rowCount > 0 : false;
}

/**
 * Check if a member has access to a specific ticket, based on its board/project.
 * Admins/owners always have access.
 */
export async function hasTicketAccess(auth: AuthMember | null, ticketId: string): Promise<boolean> {
  if (!auth) return false;
  if (auth.role === 'owner' || auth.role === 'admin') return true;

  const result = await query<{ board_id: string | null; project_id: string | null }>(
    `SELECT t.board_id, t.project_id FROM tickets t WHERE t.id = $1 LIMIT 1`,
    [ticketId]
  );
  if (!result.rows[0]) return false;
  const { board_id, project_id } = result.rows[0];

  if (board_id) return hasBoardAccess(auth, board_id);
  if (project_id) return hasProjectAccess(auth, project_id);
  return false;
}
