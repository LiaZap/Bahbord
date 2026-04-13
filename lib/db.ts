import { Pool, QueryResult, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('O ambiente DATABASE_URL não está definido. Use .env.local para configurar a conexão PostgreSQL.');
}

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

export default pool;
