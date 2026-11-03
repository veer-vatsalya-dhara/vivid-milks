import { count, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from '../src/db/client';
import { removeSampleData } from '../src/db/remove-sample-data';
import { dayLocks, deliveries, products, routes, subscriptions, users, walletTxns } from '../src/db/schema';
import { seedIfEmpty } from '../src/db/seed';
import { lockDate } from '../src/services/locking';

let database: Database;
const now = new Date('2026-11-01T04:30:00Z'); // 10:00 IST

beforeEach(async () => {
  database = await openDatabase({ pgliteDataDir: 'memory://' });
  await seedIfEmpty(database.db);
  await lockDate(database.db, '2026-11-01', now);
  await lockDate(database.db, '2026-11-02', now);
});

afterEach(async () => {
  await database.close();
});

const total = async (table: typeof users | typeof products | typeof routes | typeof deliveries | typeof walletTxns) =>
  (await database.db.select({ n: count() }).from(table))[0]!.n;

describe('removeSampleData', () => {
  it('changes nothing on a dry run', async () => {
    const report = await removeSampleData(database.db, { apply: false, now });
    expect(report.users).toHaveLength(5);
    expect(report.deliveries).toBeGreaterThan(0);
    expect(await total(users)).toBe(5);
    expect(await total(deliveries)).toBe(report.deliveries);
  });

  it('removes all sample data and unlocks future days', async () => {
    const report = await removeSampleData(database.db, { apply: true, now });
    expect(report.products).toHaveLength(4);
    expect(report.routes).toEqual(['Green Park']);
    expect(report.unlockedDates).toEqual(['2026-11-02']);
    for (const table of [users, products, routes, deliveries, walletTxns]) expect(await total(table)).toBe(0);
    const locks = await database.db.select().from(dayLocks);
    expect(locks.map((l) => l.date)).toEqual(['2026-11-01']);
  });

  it('keeps real people and anything they use', async () => {
    const db = database.db;
    // A sample person who signed in with Google counts as real.
    await db.update(users).set({ googleSub: 'g-1' }).where(eq(users.name, 'Asha Sharma'));
    const [owner] = await db
      .insert(users)
      .values({ name: 'Owner', email: 'owner@example.com', role: 'admin', googleSub: 'g-2' })
      .returning();
    const [cow1l] = await db.select().from(products).where(eq(products.unitLabel, '1 L'));
    await db.insert(subscriptions).values({ customerId: owner!.id, productId: cow1l!.id, defaultQty: 1 });

    const report = await removeSampleData(db, { apply: true, now });

    expect(report.users).toHaveLength(4);
    expect(report.productsKept).toContain('Cow Milk 1 L');
    expect(report.routesKept).toEqual(['Green Park']); // Asha is on it
    const left = await db.select({ name: users.name }).from(users);
    expect(left.map((u) => u.name).sort()).toEqual(['Asha Sharma', 'Owner']);
  });
});
