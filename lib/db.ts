import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const pool = global.pgPool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== 'production') global.pgPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: Array<unknown>): Promise<QueryResult<T>> {
  const result = await pool.query<T>(text, params);
  return result;
}

export async function getDefaultWorkspaceId(): Promise<string> {
  const result = await pool.query<{ id: string }>(`SELECT id FROM workspaces LIMIT 1`);
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Nenhum workspace encontrado');
  return id;
}

export async function getDefaultMemberId(): Promise<string> {
  const result = await pool.query<{ id: string }>(`SELECT id FROM members LIMIT 1`);
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Nenhum membro encontrado');
  return id;
}

// Whitelist de colunas permitidas por tabela para prevenir SQL injection
const ALLOWED_COLUMNS: Record<string, string[]> = {
  statuses: ['name', 'color', 'position', 'wip_limit', 'is_done'],
  services: ['name', 'color', 'is_active'],
  categories: ['name', 'color'],
  ticket_types: ['name', 'icon', 'color', 'description_template', 'position'],
  quick_reactions: ['emoji', 'label', 'position'],
  members: ['display_name', 'email', 'role', 'phone'],
  clients: ['name', 'color', 'contact_email', 'contact_phone', 'is_active'],
  tickets: ['title', 'description', 'priority', 'due_date', 'status_id', 'assignee_id', 'reporter_id', 'service_id', 'category_id', 'sprint_id', 'ticket_type_id', 'parent_id', 'client_id', 'project_id', 'board_id'],
  subtasks: ['title', 'is_completed', 'is_done', 'position'],
  time_entries: ['description', 'duration_minutes', 'is_billable'],
};

export function validateColumns(table: string, columns: string[]): boolean {
  const allowed = ALLOWED_COLUMNS[table];
  if (!allowed) return false;
  return columns.every((col) => allowed.includes(col));
}

export function filterAllowedColumns(table: string, fields: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOWED_COLUMNS[table];
  if (!allowed) return {};
  const filtered: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) filtered[key] = val;
  }
  return filtered;
}

export default pool;
