import { todayInIst } from '@vivid-milks/shared';
import { and, eq, gt, inArray, isNull, notExists, or } from 'drizzle-orm';

import type { Db } from './client';
import {
  addresses,
  buildings,
  dayLocks,
  dayOverrides,
  deliveries,
  deliveryItems,
  products,
  routes,
  subscriptions,
  users,
  walletTxns,
} from './schema';
import { SAMPLE_BUILDINGS, SAMPLE_PRODUCTS, SAMPLE_ROUTE_NAME, SAMPLE_USERS } from './seed';

export interface SampleDataReport {
  users: string[];
  products: string[];
  /** Sample products left in place because real customers use them. */
  productsKept: string[];
  routes: string[];
  /** Sample route left in place because real customers are on it. */
  routesKept: string[];
  buildings: string[];
  deliveries: number;
  walletTxns: number;
  /** Future dates unlocked because no deliveries remain on them. */
  unlockedDates: string[];
}

class DryRun extends Error {
  constructor(readonly report: SampleDataReport) {
    super('dry run');
  }
}

/**
 * Deletes the data added by `seedIfEmpty`. Only rows that still match the sample values exactly are touched;
 * sample people who have signed in with Google are treated as real. With `apply: false` nothing is changed.
 */
export async function removeSampleData(db: Db, { apply, now = new Date() }: { apply: boolean; now?: Date }) {
  try {
    return await db.transaction(async (tx) => {
      const report = await remove(tx as unknown as Db, now);
      if (!apply) throw new DryRun(report);
      return report;
    });
  } catch (error) {
    if (error instanceof DryRun) return error.report;
    throw error;
  }
}

async function remove(tx: Db, now: Date): Promise<SampleDataReport> {
  const sampleUsers = await tx
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        isNull(users.googleSub),
        or(...SAMPLE_USERS.map((u) => and(eq(users.name, u.name), eq(users.phone, u.phone)))),
      ),
    );
  const userIds = sampleUsers.map((u) => u.id);

  let deliveryCount = 0;
  let walletCount = 0;
  if (userIds.length) {
    const sampleDeliveries = await tx
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(inArray(deliveries.customerId, userIds));
    const deliveryIds = sampleDeliveries.map((d) => d.id);
    deliveryCount = deliveryIds.length;

    const deletedTxns = await tx
      .delete(walletTxns)
      .where(
        or(
          inArray(walletTxns.customerId, userIds),
          deliveryIds.length ? inArray(walletTxns.deliveryId, deliveryIds) : undefined,
        ),
      )
      .returning({ id: walletTxns.id });
    walletCount = deletedTxns.length;

    // Keep real people's records, just forget which sample user created or marked them.
    await tx.update(walletTxns).set({ createdBy: null }).where(inArray(walletTxns.createdBy, userIds));
    await tx.update(deliveries).set({ markedBy: null }).where(inArray(deliveries.markedBy, userIds));

    if (deliveryIds.length) await tx.delete(deliveries).where(inArray(deliveries.id, deliveryIds));
    // Addresses, subscriptions, pauses and day changes go with the user; routes lose their delivery person.
    await tx.delete(users).where(inArray(users.id, userIds));
  }

  const routeRows = await tx
    .select({ id: routes.id, name: routes.name })
    .from(routes)
    .where(and(eq(routes.name, SAMPLE_ROUTE_NAME), isNull(routes.deliveryUserId)));
  const removedRoutes: string[] = [];
  const keptRoutes: string[] = [];
  for (const route of routeRows) {
    const [inUse] = await tx.select({ id: addresses.userId }).from(addresses).where(eq(addresses.routeId, route.id)).limit(1);
    if (inUse) {
      keptRoutes.push(route.name);
    } else {
      await tx.delete(routes).where(eq(routes.id, route.id));
      removedRoutes.push(route.name);
    }
  }

  const removedBuildings: string[] = [];
  for (const sample of SAMPLE_BUILDINGS) {
    const [building] = await tx.select().from(buildings).where(eq(buildings.name, sample.name));
    if (!building) continue;
    const [inUse] = await tx
      .select({ id: addresses.userId })
      .from(addresses)
      .where(eq(addresses.buildingId, building.id))
      .limit(1);
    if (inUse) continue;
    await tx.delete(buildings).where(eq(buildings.id, building.id));
    removedBuildings.push(building.name);
  }

  const productRows = await tx
    .select({ id: products.id, name: products.name, unitLabel: products.unitLabel })
    .from(products)
    .where(
      or(
        ...SAMPLE_PRODUCTS.map((p) =>
          and(eq(products.name, p.name), eq(products.unitLabel, p.unitLabel), eq(products.pricePaise, p.pricePaise)),
        ),
      ),
    );
  const removedProducts: string[] = [];
  const keptProducts: string[] = [];
  for (const product of productRows) {
    const label = `${product.name} ${product.unitLabel}`;
    const used = await Promise.all([
      tx.select({ id: subscriptions.productId }).from(subscriptions).where(eq(subscriptions.productId, product.id)).limit(1),
      tx.select({ id: dayOverrides.productId }).from(dayOverrides).where(eq(dayOverrides.productId, product.id)).limit(1),
      tx.select({ id: deliveryItems.productId }).from(deliveryItems).where(eq(deliveryItems.productId, product.id)).limit(1),
    ]);
    if (used.some((rows) => rows.length > 0)) {
      keptProducts.push(label);
    } else {
      await tx.delete(products).where(eq(products.id, product.id));
      removedProducts.push(label);
    }
  }

  // A future day locked only for sample customers would block real orders for that day; let it lock again.
  const unlocked = await tx
    .delete(dayLocks)
    .where(
      and(
        gt(dayLocks.date, todayInIst(now)),
        notExists(tx.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.date, dayLocks.date))),
      ),
    )
    .returning({ date: dayLocks.date });

  return {
    users: sampleUsers.map((u) => u.name),
    products: removedProducts,
    productsKept: keptProducts,
    routes: removedRoutes,
    routesKept: keptRoutes,
    buildings: removedBuildings,
    deliveries: deliveryCount,
    walletTxns: walletCount,
    unlockedDates: unlocked.map((d) => d.date),
  };
}
