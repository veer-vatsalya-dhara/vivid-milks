import { googleVerifier } from './google';

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
  /** Google OAuth client IDs whose sign-ins are accepted (comma-separated). The first is the web client. */
  googleClientIds: list(process.env.GOOGLE_CLIENT_IDS),
  /** Emails that become admins when they sign in with Google (comma-separated). */
  adminEmails: list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  /** Signs session tokens. Required in production; development falls back to a fixed value. */
  sessionSecret: process.env.SESSION_SECRET ?? (isProduction ? undefined : 'development-only-session-secret'),
};

/** Sign-in settings for `buildApp`. */
export function authOptions() {
  return {
    devAuth: config.devAuth,
    google: { clientIds: config.googleClientIds, verify: googleVerifier(config.googleClientIds) },
    adminEmails: config.adminEmails,
    sessionSecret: config.sessionSecret,
  };
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}
