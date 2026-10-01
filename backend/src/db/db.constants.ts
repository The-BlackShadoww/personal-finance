import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export const DB_TOKEN = Symbol('DB_TOKEN');

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

/** The database or an open transaction; lets services join a caller's transaction. */
export type DbExecutor =
  | DrizzleDB
  | Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];
