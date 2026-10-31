import { sql } from 'drizzle-orm';

import type { Db } from './client';
import { addresses, products, routes, subscriptions, users, walletTxns } from './schema';

/** Sample data for development: one admin, one delivery person, a route and a few customers. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const [{ count } = { count: 0 }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) return false;

  await db.transaction(async (tx) => {
    const [admin, ravi, asha, rahul, priya] = await tx
      .insert(users)
      .values([
        { name: 'Admin', email: 'admin@vividmilks.example', phone: '9000000001', role: 'admin' },
        { name: 'Ravi (Delivery)', phone: '9000000002', role: 'delivery' },
        { name: 'Asha Sharma', phone: '9000000003', role: 'customer' },
        { name: 'Rahul Verma', phone: '9000000004', role: 'customer' },
        { name: 'Priya Nair', phone: '9000000005', role: 'customer' },
      ])
      .returning();

    const [cow500, cow1l, buffalo500] = await tx
      .insert(products)
      .values([
        { name: 'Cow Milk', unitLabel: '500 ml', pricePaise: 3400 },
        { name: 'Cow Milk', unitLabel: '1 L', pricePaise: 6600 },
        { name: 'Buffalo Milk', unitLabel: '500 ml', pricePaise: 3800 },
        { name: 'Toned Milk', unitLabel: '500 ml', pricePaise: 2800 },
      ])
      .returning();

    const [greenPark] = await tx.insert(routes).values({ name: 'Green Park', deliveryUserId: ravi!.id }).returning();

    await tx.insert(addresses).values([
      { userId: asha!.id, line1: 'A-12', area: 'Green Park', landmark: 'Near park gate', routeId: greenPark!.id, routePosition: 1 },
      { userId: rahul!.id, line1: 'B-4', area: 'Green Park', routeId: greenPark!.id, routePosition: 2 },
      { userId: priya!.id, line1: 'Flat 302, Lake View Apartments', area: 'Lake Road' },
      { userId: admin!.id, line1: 'C-1', area: 'Green Park', routeId: greenPark!.id, routePosition: 3 },
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
