import cors from '@fastify/cors';
import { googleSignInInput, type AuthConfig, type SignInResult } from '@vivid-milks/shared';
import { asc, isNull } from 'drizzle-orm';
import Fastify, { type FastifyError } from 'fastify';

import { authenticate } from './auth';
import type { Db } from './db/client';
import { users } from './db/schema';
import { HttpError, parse } from './errors';
import type { GoogleVerifier } from './google';
import { sessionTokens } from './sessions';
import { signInWithGoogle } from './services/sign-in';
import { lockDueDates } from './services/locking';
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
  /** Development sign-in: trust an `x-user-id` header. */
  devAuth: boolean;
  /** Google sign-in: client IDs to accept (the first is shown to the web app) and how to verify tokens. */
  google?: { clientIds: string[]; verify: GoogleVerifier };
  /** Emails that become admins on Google sign-in. */
  adminEmails?: string[];
  /** Signs session tokens. Required for Google sign-in. */
  sessionSecret?: string;
  logger?: boolean;
  /**
   * Lock due orders before handling API requests (at most once a minute). For serverless
   * hosting, where there is no long-running timer to do it at the cutoff.
   */
  lockOnRequest?: boolean;
}

const LOCK_ON_REQUEST_INTERVAL_MS = 60_000;

export async function buildApp({
  db,
  now,
  devAuth,
  google,
  adminEmails = [],
  sessionSecret,
  logger = false,
  lockOnRequest = false,
}: AppOptions) {
  const app = Fastify({ logger });
  // Development serves the app and API on different ports; list every method the API uses (the default omits PUT and DELETE).
  await app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'] });
  app.decorateRequest('user', null);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    reply.status(status).send({ error: status >= 500 ? 'Something went wrong' : error.message });
  });

  app.get('/health', async () => ({ ok: true }));

  const sessions = sessionSecret ? sessionTokens(sessionSecret) : null;
  const googleEnabled = Boolean(google && google.clientIds.length > 0 && sessions);
  if (!googleEnabled && !devAuth) {
    // No way to sign in; refuse to serve data.
    app.log.warn('Neither Google sign-in nor DEV_AUTH is configured: API routes are disabled');
    return app;
  }

  /** Tells the app which sign-in options to show. */
  app.get('/api/auth/config', async (): Promise<AuthConfig> => ({
    googleWebClientId: googleEnabled ? google!.clientIds[0]! : null,
    devSignIn: devAuth,
  }));

  app.post('/api/auth/google', async (req): Promise<SignInResult> => {
    if (!googleEnabled) throw new HttpError(404, 'Google sign-in is not set up');
    const { idToken } = parse(googleSignInInput, req.body);
    const identity = await google!.verify(idToken).catch((error: unknown) => {
      req.log.warn({ error }, 'Google token rejected');
      throw new HttpError(401, 'Google sign-in failed. Please try again.');
    });
    const user = await signInWithGoogle(db, identity, adminEmails);
    return { token: await sessions!.issue(user.id), user };
  });

  if (devAuth) {
    /** Users to pick from in the app's development sign-in screen. */
    app.get('/api/dev/users', async () =>
      db
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(isNull(users.removedAt))
        .orderBy(asc(users.role), asc(users.name)),
    );
  }

  const context: AppContext = { db, now };
  let lastLockCheck = 0;
  await app.register(async (api) => {
    if (lockOnRequest) {
      api.addHook('onRequest', async () => {
        if (now().getTime() - lastLockCheck < LOCK_ON_REQUEST_INTERVAL_MS) return;
        lastLockCheck = now().getTime();
        for (const result of await lockDueDates(db, now())) app.log.info({ lock: result }, 'Locked orders');
      });
    }
    api.addHook('preHandler', authenticate(db, sessions, devAuth));
    await api.register(commonRoutes, context);
    await api.register(customerRoutes, { ...context, prefix: '/me' });
    await api.register(deliveryRoutes, { ...context, prefix: '/delivery' });
    await api.register(adminRoutes, { ...context, prefix: '/admin' });
  }, { prefix: '/api' });

  return app;
}
