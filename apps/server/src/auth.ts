import type { Role, User } from '@vivid-milks/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Db } from './db/client';
import { users } from './db/schema';
import { forbidden, HttpError } from './errors';
import type { SessionTokens } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

export function toUser(u: typeof users.$inferSelect): User {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role };
}

/**
 * Signs the request in from a session token (`Authorization: Bearer …`), or, when
 * development sign-in is on, from an `x-user-id` header. Removed people are refused.
 */
export function authenticate(db: Db, sessions: SessionTokens | null, devAuth: boolean) {
  return async (request: FastifyRequest) => {
    let id: number | null = null;
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ') && sessions) {
      id = await sessions.verify(header.slice('Bearer '.length));
    } else if (devAuth && request.headers['x-user-id']) {
      const devId = Number(request.headers['x-user-id']);
      id = Number.isInteger(devId) && devId > 0 ? devId : null;
    }
    if (id === null) throw new HttpError(401, 'Sign in required');

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.removedAt)));
    if (!user) throw new HttpError(401, 'Sign in required');
    request.user = toUser(user);
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
