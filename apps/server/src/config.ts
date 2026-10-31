// Load .env when present (Node's built-in loader); real environment variables take precedence.
try {
  process.loadEnvFile();
} catch {
  // No .env file.
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  /** Postgres connection string. When unset, an embedded PGlite database is used (development only). */
  databaseUrl: process.env.DATABASE_URL,
  pgliteDataDir: process.env.PGLITE_DATA_DIR ?? '.data/pglite',
  /**
   * Development sign-in: the app picks a user and sends `x-user-id`.
   * Never enable in production; it is replaced by real login later.
   */
  devAuth: process.env.DEV_AUTH ? process.env.DEV_AUTH === 'true' : !isProduction,
  seedIfEmpty: process.env.SEED_IF_EMPTY ? process.env.SEED_IF_EMPTY === 'true' : !isProduction,
};
