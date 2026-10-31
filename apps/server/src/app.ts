import cors from '@fastify/cors';
import { asc } from 'drizzle-orm';
import Fastify, { type FastifyError } from 'fastify';

import { devAuthenticate } from './auth';
import type { Db } from './db/client';
import { users } from './db/schema';
import { adminRoutes } from './routes/admin';
import { commonRoutes } from './routes/common';
import { customerRoutes } from './routes/customer';
import { deliveryRoutes } from './routes/delivery';

export interface AppContext {
  db: Db;
  /** Injectable clock so tests can control "now". */
  now: () => Date;
}

export interface AppOptions extends AppContext {
  devAuth: boolean;
  logger?: boolean;
}

export async function buildApp({ db, now, devAuth, logger = false }: AppOptions) {
  const app = Fastify({ logger });
  await app.register(cors, { origin: true });
  app.decorateRequest('user', null);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    reply.status(status).send({ error: status >= 500 ? 'Something went wrong' : error.message });
  });

  app.get('/health', async () => ({ ok: true }));

  if (!devAuth) {
    // Real login is not built yet; refuse to serve data without it.
    app.log.warn('DEV_AUTH is off and no other sign-in exists yet: API routes are disabled');
    return app;
  }

  /** Users to pick from in the app's development sign-in screen. */
  app.get('/api/dev/users', async () =>
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .orderBy(asc(users.role), asc(users.name)),
  );

  const context: AppContext = { db, now };
  await app.register(async (api) => {
    api.addHook('preHandler', devAuthenticate(db));
    await api.register(commonRoutes, context);
    await api.register(customerRoutes, { ...context, prefix: '/me' });
    await api.register(deliveryRoutes, { ...context, prefix: '/delivery' });
    await api.register(adminRoutes, { ...context, prefix: '/admin' });
  }, { prefix: '/api' });

  return app;
}
