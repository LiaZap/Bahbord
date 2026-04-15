import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'bahjira';


declare global {
  // eslint-disable-next-line no-var
  var mongoClient: MongoClient | undefined;
}

let client: MongoClient;

async function getClient(): Promise<MongoClient> {
  if (global.mongoClient) return global.mongoClient;

  client = new MongoClient(MONGODB_URI);
  await client.connect();

  if (process.env.NODE_ENV !== 'production') {
    global.mongoClient = client;
  }

  return client;
}

export async function getDb(): Promise<Db> {
  const c = await getClient();
  return c.db(MONGODB_DB);
}

// Collection names
export const COLLECTIONS = {
  ACCESS_LOGS: 'access_logs',
  AUDIT_TRAIL: 'audit_trail',
  TIME_LOGS: 'time_logs',
} as const;
