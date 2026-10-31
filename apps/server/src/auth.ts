import type { Role, User } from '@vivid-milks/shared';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Db } from './db/client';
import { users } from './db/schema';
import { forbidden, HttpError } from './errors';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

/**
 * Development sign-in: trusts the `x-user-id` header. Replaced by real login
 * (WhatsApp OTP / Google) before launch; only enabled when `devAuth` is on.
 */
export function devAuthenticate(db: Db) {
  return async (request: FastifyRequest) => {
    const id = Number(request.headers['x-user-id']);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(401, 'Sign in required');
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) throw new HttpError(401, 'Sign in required');
    request.user = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
  };
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user || !roles.includes(request.user.role)) throw forbidden();
  };
}

export function currentUser(request: FastifyRequest): User {
  if (!request.user) throw new HttpError(401, 'Sign in required');
  return request.user;
}
