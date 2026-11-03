import { sql } from 'drizzle-orm';

import type { Db } from './client';
import { addresses, buildings, products, routes, subscriptions, users, walletTxns } from './schema';

/** Sample people. `remove-sample-data` matches on these exact values. */
export const SAMPLE_USERS = [
  { name: 'Admin', email: 'admin@vividmilks.example', phone: '9000000001', role: 'admin' },
  { name: 'Ravi (Delivery)', phone: '9000000002', role: 'delivery' },
  { name: 'Asha Sharma', phone: '9000000003', role: 'customer' },
  { name: 'Rahul Verma', phone: '9000000004', role: 'customer' },
  { name: 'Priya Nair', phone: '9000000005', role: 'customer' },
] as const;

/** Sample products. `remove-sample-data` matches on these exact values. */
export const SAMPLE_PRODUCTS = [
  { name: 'Cow Milk', unitLabel: '500 ml', pricePaise: 3400 },
  { name: 'Cow Milk', unitLabel: '1 L', pricePaise: 6600 },
  { name: 'Buffalo Milk', unitLabel: '500 ml', pricePaise: 3800 },
  { name: 'Toned Milk', unitLabel: '500 ml', pricePaise: 2800 },
] as const;

export const SAMPLE_ROUTE_NAME = 'Green Park';

/** Sample buildings. `remove-sample-data` removes them when nobody else lives there. */
export const SAMPLE_BUILDINGS = [
  { name: 'Green Park Residency', blocks: ['A', 'B'] },
  { name: 'Lake View Apartments', blocks: [] },
] as const;

/** Sample data for development: one admin, one delivery person, a route and a few customers. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const [{ count } = { count: 0 }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) return false;

  await db.transaction(async (tx) => {
    const [admin, ravi, asha, rahul, priya] = await tx
      .insert(users)
      .values([...SAMPLE_USERS])
      .returning();

    const [cow500, cow1l, buffalo500] = await tx
      .insert(products)
      .values([...SAMPLE_PRODUCTS])
      .returning();

    const [greenPark] = await tx.insert(routes).values({ name: SAMPLE_ROUTE_NAME, deliveryUserId: ravi!.id }).returning();

    const [residency, lakeView] = await tx
      .insert(buildings)
      .values(SAMPLE_BUILDINGS.map((b) => ({ name: b.name, blocks: [...b.blocks] })))
      .returning();

    await tx.insert(addresses).values([
      { userId: asha!.id, buildingId: residency!.id, block: 'A', floor: 1, line1: '12', landmark: 'Near park gate', routeId: greenPark!.id, routePosition: 1 },
      { userId: rahul!.id, buildingId: residency!.id, block: 'B', floor: 0, line1: '4', routeId: greenPark!.id, routePosition: 2 },
      { userId: priya!.id, buildingId: lakeView!.id, floor: 3, line1: '302' },
      { userId: admin!.id, buildingId: residency!.id, block: 'B', floor: 4, line1: '401', routeId: greenPark!.id, routePosition: 3 },
    ]);

    await tx.insert(subscriptions).values([
      { customerId: asha!.id, productId: cow500!.id, defaultQty: 2 },
      { customerId: rahul!.id, productId: cow1l!.id, defaultQty: 1 },
      { customerId: rahul!.id, productId: buffalo500!.id, defaultQty: 1 },
      { customerId: priya!.id, productId: cow500!.id, defaultQty: 1 },
      { customerId: admin!.id, productId: cow500!.id, defaultQty: 1 },
    ]);

    // Rahul is left with a low balance so the low-balance flow can be seen.
    await tx.insert(walletTxns).values([
      { customerId: asha!.id, amountPaise: 100000, type: 'topup', note: 'Cash', createdBy: admin!.id },
      { customerId: rahul!.id, amountPaise: 5000, type: 'topup', note: 'UPI', createdBy: admin!.id },
      { customerId: priya!.id, amountPaise: 50000, type: 'topup', note: 'UPI', createdBy: admin!.id },
      { customerId: admin!.id, amountPaise: 50000, type: 'topup', note: 'Cash', createdBy: admin!.id },
    ]);
  });
  return true;
}
