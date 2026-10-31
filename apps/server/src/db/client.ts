import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';

import * as schema from './schema';

/** Works with both node-postgres (production) and PGlite (development, tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

/** Connects to Postgres at `databaseUrl`, or to PGlite at `pgliteDataDir` (`memory://` for an in-memory database). */
export async function openDatabase(opts: { databaseUrl?: string; pgliteDataDir: string }): Promise<Database> {
  if (opts.databaseUrl) {
    const pool = new pg.Pool({ connectionString: opts.databaseUrl });
    const db = drizzleNodePg(pool, { schema });
    await migrateNodePg(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => pool.end() };
  }

  if (!opts.pgliteDataDir.startsWith('memory://')) mkdirSync(opts.pgliteDataDir, { recursive: true });
  const client = new PGlite(opts.pgliteDataDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => client.close() };
}
