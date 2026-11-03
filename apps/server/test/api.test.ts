import type {
  AdminDashboard,
  CustomerHome,
  Day,
  DeliveryRun,
  LockResult,
  Pause,
  Schedule,
  Wallet,
} from '@vivid-milks/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { seedIfEmpty } from '../src/db/seed';
import { lockDueDates } from '../src/services/locking';

// Seeded users, in insert order.
const ADMIN = 1;
const RAVI = 2;
const ASHA = 3;
const RAHUL = 4;
const PRIYA = 5;
const COW_500 = 1;

/** `HH:MM` IST on `date` as a Date. */
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);

let database: Database;
let app: FastifyInstance;
let clock: Date;

beforeEach(async () => {
  database = await openDatabase({ pgliteDataDir: 'memory://' });
  await seedIfEmpty(database.db);
  clock = ist('2026-11-01', '10:00');
  app = await buildApp({ db: database.db, now: () => clock, devAuth: true });
});

afterEach(async () => {
  await app.close();
  await database.close();
});

async function call<T>(userId: number | null, method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: object) {
  const res = await app.inject({
    method,
    url,
    headers: userId ? { 'x-user-id': String(userId) } : {},
    ...(body ? { payload: body } : {}),
  });
  return { status: res.statusCode, body: res.json() as T };
}

describe('access', () => {
  it('requires a user and the right role', async () => {
    expect((await call(null, 'GET', '/api/me')).status).toBe(401);
    expect((await call(ASHA, 'GET', '/api/admin/dashboard')).status).toBe(403);
    expect((await call(ASHA, 'GET', '/api/delivery/run')).status).toBe(403);
    expect((await call(RAVI, 'GET', '/api/me/home')).status).toBe(403);
    expect((await call(ADMIN, 'GET', '/api/me/home')).status).toBe(200);
    expect((await call(ADMIN, 'GET', '/api/delivery/run')).status).toBe(200);
  });
});

describe('customer orders', () => {
  it('shows tomorrow on the home screen', async () => {
    const { body } = await call<CustomerHome>(ASHA, 'GET', '/api/me/home');
    expect(body.nextDay).toMatchObject({ date: '2026-11-02', editable: true, status: 'planned', totalPaise: 6800 });
    expect(body.shortfallPaise).toBeNull();
    expect(body.settings).toEqual({ orderCutoffTime: '18:00', deliveryTime: '07:00' });
  });

  it('changes one day and changes it back', async () => {
    const changed = await call<Day>(ASHA, 'PUT', `/api/me/schedule/2026-11-02/${COW_500}`, { qty: 3 });
    expect(changed.body.items).toEqual([{ productId: COW_500, qty: 3, changed: true }]);

    const reverted = await call<Day>(ASHA, 'PUT', `/api/me/schedule/2026-11-02/${COW_500}`, { qty: 2 });
    expect(reverted.body.items).toEqual([{ productId: COW_500, qty: 2, changed: false }]);
  });

  it('refuses changes after the cutoff', async () => {
    expect((await call(ASHA, 'PUT', `/api/me/schedule/2026-11-01/${COW_500}`, { qty: 0 })).status).toBe(409);
    clock = ist('2026-11-01', '18:00');
    expect((await call(ASHA, 'PUT', `/api/me/schedule/2026-11-02/${COW_500}`, { qty: 0 })).status).toBe(409);
    expect((await call(ASHA, 'PUT', `/api/me/schedule/2026-11-03/${COW_500}`, { qty: 0 })).status).toBe(200);
  });

  it('pauses and resumes', async () => {
    const paused = await call<{ pause: Pause }>(ASHA, 'POST', '/api/me/pause', {
      startDate: '2026-11-03',
      endDate: '2026-11-05',
    });
    expect(paused.body.pause).toMatchObject({ startDate: '2026-11-03', endDate: '2026-11-05' });

    const { body } = await call<Schedule>(ASHA, 'GET', '/api/me/schedule?from=2026-11-02&to=2026-11-06');
    expect(body.days.map((d) => d.totalPaise)).toEqual([6800, 0, 0, 0, 6800]);

    // Too early: tomorrow is still open, but today is not.
    expect((await call(ASHA, 'POST', '/api/me/pause', { startDate: '2026-11-01', endDate: null })).status).toBe(409);

    // Resuming on the 4th keeps the 3rd (already locked) paused.
    clock = ist('2026-11-02', '23:00');
    const resumed = await call<{ pause: Pause | null }>(ASHA, 'DELETE', '/api/me/pause');
    expect(resumed.body.pause).toMatchObject({ startDate: '2026-11-03', endDate: '2026-11-03' });
  });
});

describe('locking and delivery', () => {
  async function lockNov2() {
    clock = ist('2026-11-01', '18:00');
    return call<LockResult>(ADMIN, 'POST', '/api/admin/lock', { date: '2026-11-02' });
  }

  it('creates deliveries for customers with an address and enough balance, route or not', async () => {
    const { body } = await lockNov2();
    // Asha, Admin and Priya (no route) have balance. Rahul's ₹104 order exceeds his ₹50.
    expect(body).toEqual({ date: '2026-11-02', alreadyLocked: false, created: 3, skippedLowBalance: 1 });
    expect((await lockNov2()).body.alreadyLocked).toBe(true);

    const rahul = await call<Schedule>(RAHUL, 'GET', '/api/me/schedule?from=2026-11-02&to=2026-11-02');
    expect(rahul.body.days[0]).toMatchObject({ status: 'skipped_low_balance', editable: false });
    const priya = await call<Schedule>(PRIYA, 'GET', '/api/me/schedule?from=2026-11-02&to=2026-11-02');
    expect(priya.body.days[0]).toMatchObject({ status: 'pending' });
  });

  it('flags low balances before the cutoff', async () => {
    const home = await call<CustomerHome>(RAHUL, 'GET', '/api/me/home');
    expect(home.body.shortfallPaise).toBe(10400 - 5000);

    const { body } = await call<AdminDashboard>(ADMIN, 'GET', '/api/admin/dashboard');
    expect(body.lowBalanceCustomers.map((c) => c.id)).toEqual([RAHUL]);
    expect(body.noAddressCustomers).toEqual([]);
    expect(body.tomorrow.locked).toBe(false);
  });

  it('lets delivery staff work through the run and undo mistakes', async () => {
    await lockNov2();
    clock = ist('2026-11-02', '06:00');

    // Everyone's drops, by building (Z→A), block, then floor from the top.
    const run = await call<DeliveryRun>(RAVI, 'GET', '/api/delivery/run');
    expect(run.body.drops.map((d) => d.customerName)).toEqual(['Priya Nair', 'Asha Sharma', 'Admin']);
    expect(run.body.totals).toEqual([{ productId: COW_500, name: 'Cow Milk', unitLabel: '500 ml', qty: 4 }]);

    const asha = run.body.drops[1]!.id;
    const balance = async () => (await call<Wallet>(ASHA, 'GET', '/api/me/wallet')).body.balancePaise;

    await call(RAVI, 'POST', `/api/delivery/drops/${asha}/mark`, { status: 'delivered' });
    await call(RAVI, 'POST', `/api/delivery/drops/${asha}/mark`, { status: 'delivered' });
    expect(await balance()).toBe(100000 - 6800);

    await call(RAVI, 'POST', `/api/delivery/drops/${asha}/mark`, { status: 'not_delivered', reason: 'door_locked' });
    expect(await balance()).toBe(100000);

    expect((await call(RAVI, 'POST', `/api/delivery/drops/${asha}/mark`, { status: 'not_delivered' })).status).toBe(
      400,
    );

    clock = ist('2026-11-03', '06:00');
    expect((await call(RAVI, 'POST', `/api/delivery/drops/${asha}/mark`, { status: 'delivered' })).status).toBe(400);
  });

  it('locks due dates on schedule', async () => {
    clock = ist('2026-11-01', '17:59');
    expect((await lockDueDates(database.db, clock)).map((r) => r.date)).toEqual(['2026-11-01']);
    clock = ist('2026-11-01', '18:00');
    expect((await lockDueDates(database.db, clock)).map((r) => r.date)).toEqual(['2026-11-02']);
    expect(await lockDueDates(database.db, clock)).toEqual([]);
  });

  it('locks due dates when requests arrive, for serverless hosting', async () => {
    const lazy = await buildApp({ db: database.db, now: () => clock, devAuth: true, lockOnRequest: true });
    clock = ist('2026-11-01', '18:05');
    await lazy.inject({ method: 'GET', url: '/api/me', headers: { 'x-user-id': String(RAVI) } });
    const { body } = await call<LockResult>(ADMIN, 'POST', '/api/admin/lock', { date: '2026-11-02' });
    expect(body.alreadyLocked).toBe(true);
    await lazy.close();
  });

  it('resumes deliveries after a top-up', async () => {
    await call(ADMIN, 'POST', `/api/admin/customers/${RAHUL}/wallet`, { amountPaise: 10000, note: 'Cash' });
    const { body } = await lockNov2();
    expect(body).toMatchObject({ created: 4, skippedLowBalance: 0 });
  });
});
