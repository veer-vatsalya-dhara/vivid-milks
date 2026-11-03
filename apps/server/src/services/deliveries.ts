import {
  todayInIst,
  type DeliveryRun,
  type Drop,
  type IsoDate,
  type LineItem,
  type markDeliveryInput,
  type User,
} from '@vivid-milks/shared';
import type { z } from 'zod';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { addresses, buildings, deliveries, deliveryItems, products, routes, users, walletTxns } from '../db/schema';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { toAddress } from './buildings';
import { loadLockedDates } from './data';

/** Adds up quantities per product, in product order. */
export function sumLineItems(items: LineItem[]): LineItem[] {
  const totals = new Map<number, LineItem>();
  for (const item of items) {
    const existing = totals.get(item.productId);
    if (existing) existing.qty += item.qty;
    else totals.set(item.productId, { ...item });
  }
  return [...totals.values()].sort((a, b) => a.productId - b.productId);
}

/** Drops for `date`. Delivery staff see the routes currently assigned to them; admins see all, optionally one route. */
export async function getDeliveryRun(
  db: Db,
  user: User,
  date: IsoDate,
  routeId: number | null,
): Promise<DeliveryRun> {
  const conditions = [eq(deliveries.date, date), ne(deliveries.status, 'skipped_low_balance')];
  if (user.role === 'delivery') conditions.push(eq(routes.deliveryUserId, user.id));
  if (routeId !== null) conditions.push(eq(deliveries.routeId, routeId));

  const rows = await db
    .select({
      delivery: deliveries,
      customer: users,
      address: addresses,
      buildingName: buildings.name,
      routeName: routes.name,
    })
    .from(deliveries)
    .innerJoin(users, eq(users.id, deliveries.customerId))
    .leftJoin(addresses, eq(addresses.userId, deliveries.customerId))
    .leftJoin(buildings, eq(buildings.id, addresses.buildingId))
    .leftJoin(routes, eq(routes.id, deliveries.routeId))
    .where(and(...conditions))
    .orderBy(asc(routes.name), sql`${deliveries.routePosition} asc nulls last`, asc(users.name));

  const itemRows = rows.length
    ? await db
        .select({
          deliveryId: deliveryItems.deliveryId,
          productId: deliveryItems.productId,
          qty: deliveryItems.qty,
          name: products.name,
          unitLabel: products.unitLabel,
        })
        .from(deliveryItems)
        .innerJoin(products, eq(products.id, deliveryItems.productId))
        .where(
          inArray(
            deliveryItems.deliveryId,
            rows.map((r) => r.delivery.id),
          ),
        )
        .orderBy(asc(deliveryItems.productId))
    : [];

  const drops: Drop[] = rows.map(({ delivery, customer, address, buildingName, routeName }) => ({
    id: delivery.id,
    customerName: customer.name,
    phone: customer.phone,
    address: address && toAddress(address, buildingName),
    routeName,
    routePosition: delivery.routePosition,
    items: itemRows
      .filter((i) => i.deliveryId === delivery.id)
      .map(({ productId, name, unitLabel, qty }) => ({ productId, name, unitLabel, qty })),
    status: delivery.status,
    reason: delivery.reason,
  }));

  const locked = (await loadLockedDates(db, date, date)).has(date);
  return { date, locked, totals: sumLineItems(drops.flatMap((d) => d.items)), drops };
}

/**
 * Marks a drop. Delivered debits the wallet; any other status removes that debit, so
 * mistakes can be undone. Delivery staff can only mark today's drops on their routes.
 */
export async function markDelivery(
  db: Db,
  user: User,
  deliveryId: number,
  input: z.output<typeof markDeliveryInput>,
  now: Date,
): Promise<{ id: number; status: Drop['status']; reason: Drop['reason'] }> {
  const [row] = await db
    .select({ delivery: deliveries, routeDeliveryUserId: routes.deliveryUserId })
    .from(deliveries)
    .leftJoin(routes, eq(routes.id, deliveries.routeId))
    .where(eq(deliveries.id, deliveryId));
  if (!row) throw notFound('Delivery');
  const { delivery } = row;

  const today = todayInIst(now);
  if (user.role === 'delivery') {
    if (row.routeDeliveryUserId !== user.id) throw forbidden('This drop is not on your route');
    if (delivery.date !== today) throw badRequest("Only today's drops can be updated");
  } else if (delivery.date > today) {
    throw badRequest('This delivery is not due yet');
  }
  if (delivery.status === 'skipped_low_balance') throw conflict('This delivery was skipped for low balance');

  await db.transaction(async (tx) => {
    await tx
      .update(deliveries)
      .set({
        status: input.status,
        reason: input.status === 'not_delivered' ? input.reason : null,
        markedBy: input.status === 'pending' ? null : user.id,
        markedAt: input.status === 'pending' ? null : now,
      })
      .where(eq(deliveries.id, deliveryId));

    if (input.status === 'delivered') {
      await tx
        .insert(walletTxns)
        .values({
          customerId: delivery.customerId,
          amountPaise: -delivery.totalPaise,
          type: 'delivery',
          deliveryId,
          note: `Delivery on ${delivery.date}`,
          createdBy: user.id,
        })
        .onConflictDoNothing({ target: walletTxns.deliveryId });
    } else {
      await tx.delete(walletTxns).where(eq(walletTxns.deliveryId, deliveryId));
    }
  });

  return {
    id: deliveryId,
    status: input.status,
    reason: input.status === 'not_delivered' ? input.reason : null,
  };
}
