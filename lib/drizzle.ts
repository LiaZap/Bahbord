import { drizzle } from 'drizzle-orm/node-postgres';
import pool from './db';
import * as schema from './schema';

export const db = drizzle(pool, { schema });

export { schema };
export type DB = typeof db;
