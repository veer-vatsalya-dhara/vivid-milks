import type { AuthConfig, Me, SignInResult, User } from '@vivid-milks/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { seedIfEmpty } from '../src/db/seed';
import type { GoogleVerifier } from '../src/google';

const ADMIN = 1;
const RAVI = 2;
const ASHA = 3;

/** Stand-in for Google: tokens look like "sub|email|name|verified". */
const fakeGoogle: GoogleVerifier = async (token) => {
  const [sub, email, name, verified] = token.split('|');
  if (!sub || !email) throw new Error('bad token');
  return { sub, email: email.toLowerCase(), name: name ?? email, emailVerified: verified !== 'unverified' };
};

let database: Database;
let app: FastifyInstance;
const now = new Date('2026-11-01T04:30:00Z');

beforeEach(async () => {
  database = await openDatabase({ pgliteDataDir: 'memory://' });
  await seedIfEmpty(database.db);
  app = await buildApp({
    db: database.db,
    now: () => now,
    devAuth: true,
    google: { clientIds: ['web-client'], verify: fakeGoogle },
    adminEmails: ['owner@example.com'],
    sessionSecret: 'test-secret',
  });
});

afterEach(async () => {
  await app.close();
  await database.close();
});

async function call<T>(
  auth: { userId?: number; token?: string },
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  url: string,
  body?: object,
) {
  const headers: Record<string, string> = {};
  if (auth.userId) headers['x-user-id'] = String(auth.userId);
  if (auth.token) headers.authorization = `Bearer ${auth.token}`;
  const res = await app.inject({ method, url, headers, ...(body ? { payload: body } : {}) });
  return { status: res.statusCode, body: res.json() as T };
}

const googleSignIn = (idToken: string) => call<SignInResult>({}, 'POST', '/api/auth/google', { idToken });

describe('Google sign-in', () => {
  it('advertises the web client ID', async () => {
    const { body } = await call<AuthConfig>({}, 'GET', '/api/auth/config');
    expect(body).toEqual({ googleWebClientId: 'web-client', devSignIn: true });
  });

  it('creates a customer for a new account and returns a working session', async () => {
    const { status, body } = await googleSignIn('g-1|New.Person@Gmail.com|New Person');
    expect(status).toBe(200);
    expect(body.user).toMatchObject({ name: 'New Person', email: 'new.person@gmail.com', role: 'customer' });

    const me = await call<Me>({ token: body.token }, 'GET', '/api/me');
    expect(me.body.id).toBe(body.user.id);

    // Same Google account again: same person.
    expect((await googleSignIn('g-1|new.person@gmail.com|New Person')).body.user.id).toBe(body.user.id);
  });

  it('matches people added by an admin by email, keeping their role', async () => {
    const added = await call<User>({ userId: ADMIN }, 'POST', '/api/admin/users', {
      name: 'Suresh',
      email: 'Suresh@Example.com',
      role: 'delivery',
    });
    const { body } = await googleSignIn('g-2|suresh@example.com|Suresh K');
    expect(body.user).toMatchObject({ id: added.body.id, role: 'delivery' });
  });

  it('makes ADMIN_EMAILS admins', async () => {
    expect((await googleSignIn('g-3|owner@example.com|Owner')).body.user.role).toBe('admin');
  });

  it('rejects bad tokens, unverified emails and forged sessions', async () => {
    expect((await googleSignIn('garbage')).status).toBe(401);
    expect((await googleSignIn('g-4|x@example.com|X|unverified')).status).toBe(403);
    expect((await call({ token: 'not-a-token' }, 'GET', '/api/me')).status).toBe(401);
  });
});

describe('managing people', () => {
  it('edits details and roles, keeping at least one admin', async () => {
    const edited = await call<User>({ userId: ADMIN }, 'PUT', `/api/admin/users/${RAVI}`, {
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9000000002',
      role: 'delivery',
    });
    expect(edited.body).toMatchObject({ name: 'Ravi Kumar', email: 'ravi@example.com' });

    const demoteSelf = await call(
      { userId: ADMIN },
      'PUT',
      `/api/admin/users/${ADMIN}`,
      { name: 'Admin', role: 'customer' },
    );
    expect(demoteSelf.status).toBe(400);

    const duplicate = await call({ userId: ADMIN }, 'POST', '/api/admin/users', {
      name: 'Copy',
      email: 'ravi@example.com',
      role: 'customer',
    });
    expect(duplicate.status).toBe(409);
  });

  it('removes a customer: no sign-in, no future orders, history kept', async () => {
    await call({ userId: ADMIN }, 'PUT', `/api/admin/users/${ASHA}`, {
      name: 'Asha Sharma',
      email: 'asha@example.com',
      role: 'customer',
    });
    // Asha has a locked delivery for tomorrow.
    await call({ userId: ADMIN }, 'POST', '/api/admin/lock', { date: '2026-11-02' });

    expect((await call({ userId: ADMIN }, 'DELETE', `/api/admin/users/${ASHA}`)).status).toBe(200);

    expect((await call({ userId: ASHA }, 'GET', '/api/me')).status).toBe(401);
    const users = await call<User[]>({ userId: ADMIN }, 'GET', '/api/admin/users');
    expect(users.body.some((u) => u.id === ASHA)).toBe(false);

    const run = await call<{ drops: { customerName: string }[] }>(
      { userId: ADMIN },
      'GET',
      '/api/delivery/run?date=2026-11-02',
    );
    expect(run.body.drops.map((d) => d.customerName)).not.toContain('Asha Sharma');

    // Re-adding the email restores the same account.
    const restored = await call<User>({ userId: ADMIN }, 'POST', '/api/admin/users', {
      name: 'Asha Sharma',
      email: 'Asha@example.com',
      role: 'customer',
    });
    expect(restored.body.id).toBe(ASHA);
    expect((await call({ userId: ASHA }, 'GET', '/api/me')).status).toBe(200);
  });

  it('refuses to remove yourself, and removed accounts cannot sign in with Google', async () => {
    expect((await call({ userId: ADMIN }, 'DELETE', `/api/admin/users/${ADMIN}`)).status).toBe(400);

    const { body } = await googleSignIn('g-5|leaver@example.com|Leaver');
    await call({ userId: ADMIN }, 'DELETE', `/api/admin/users/${body.user.id}`);
    expect((await googleSignIn('g-5|leaver@example.com|Leaver')).status).toBe(403);
    expect((await call({ token: body.token }, 'GET', '/api/me')).status).toBe(401);
  });

  it('frees a removed delivery person’s route', async () => {
    await call({ userId: ADMIN }, 'DELETE', `/api/admin/users/${RAVI}`);
    const routes = await call<{ deliveryUserId: number | null }[]>({ userId: ADMIN }, 'GET', '/api/admin/routes');
    expect(routes.body[0]!.deliveryUserId).toBeNull();
  });
});
