import type { IncomingMessage, ServerResponse } from 'node:http';

import { buildApp } from './app';
import { config } from './config';
import { openDatabase } from './db/client';

/**
 * Vercel serverless entry point. The database is migrated and seeded during the
 * deploy (see scripts/migrate.ts); here we only connect.
 */
async function createApp() {
  const { db } = await openDatabase({ ...config, migrate: false });
  const app = await buildApp({ db, now: () => new Date(), devAuth: config.devAuth, logger: true, lockOnRequest: true });
  await app.ready();
  return app;
}

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= createApp().catch((error) => {
    appPromise = undefined;
    throw error;
  });
  const app = await appPromise;
  app.server.emit('request', req, res);
}
