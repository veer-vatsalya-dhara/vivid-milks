import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import * as schema from './schema';

/** Works with both node-postgres (production) and PGlite (development, tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Resolved lazily: bundled serverless builds don't migrate and have no `import.meta.url`. */
const migrationsFolder = () => resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export interface Database {
  db: Db;
  close: () => Promise<void>;
}

export interface DatabaseOptions {
  databaseUrl?: string;
  pgliteDataDir: string;
  /** Apply pending migrations. Off for serverless functions, which rely on the deploy step instead. */
  migrate?: boolean;
}

/** Connects to Postgres at `databaseUrl`, or to PGlite at `pgliteDataDir` (`memory://` for an in-memory database). */
export async function openDatabase({ databaseUrl, pgliteDataDir, migrate = true }: DatabaseOptions): Promise<Database> {
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const db = drizzleNodePg(pool, { schema });
    if (migrate) await migrateNodePg(db, { migrationsFolder: migrationsFolder() });
    return { db: db as unknown as Db, close: () => pool.end() };
  }

  // Loaded only when needed, so production bundles don't include PGlite.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');
  const { migrate: migratePglite } = await import('drizzle-orm/pglite/migrator');
  if (!pgliteDataDir.startsWith('memory://')) mkdirSync(pgliteDataDir, { recursive: true });
  const client = new PGlite(pgliteDataDir);
  const db = drizzlePglite(client, { schema });
  if (migrate) await migratePglite(db, { migrationsFolder: migrationsFolder() });
  return { db: db as unknown as Db, close: () => client.close() };
}
