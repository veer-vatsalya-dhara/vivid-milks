import { addDays, isPastCutoff, todayInIst, type IsoDate, type LockResult } from '@vivid-milks/shared';
import { inArray } from 'drizzle-orm';

import type { Db } from '../db/client';
import { addresses, dayLocks, deliveries, deliveryItems } from '../db/schema';
import { customersWithOrders, loadLockedDates, loadPlanInputs, loadProducts, loadWalletSummaries } from './data';
import { planDay } from './planner';
import { getSettings } from './settings';

/**
 * Turns every customer's order for `date` into a delivery. Runs once per date; later calls
 * are no-ops. Customers without a route get nothing; customers whose available balance
 * doesn't cover the whole order get a `skipped_low_balance` record instead.
 */
export async function lockDate(db: Db, date: IsoDate, now: Date): Promise<LockResult> {
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(dayLocks).values({ date }).onConflictDoNothing().returning();
    if (inserted.length === 0) return { date, alreadyLocked: true, created: 0, skippedLowBalance: 0 };

    const customerIds = await customersWithOrders(tx, date, date);
    const [products, inputs, wallets, addressRows] = await Promise.all([
      loadProducts(tx),
      loadPlanInputs(tx, customerIds, date, date),
      loadWalletSummaries(tx, customerIds, todayInIst(now)),
      customerIds.length ? tx.select().from(addresses).where(inArray(addresses.userId, customerIds)) : [],
    ]);
    const addressByCustomer = new Map(addressRows.map((a) => [a.userId, a]));

    let created = 0;
    let skippedLowBalance = 0;
    for (const customerId of customerIds) {
      const address = addressByCustomer.get(customerId);
      if (!address?.routeId) continue;
      const plan = planDay(date, inputs.get(customerId)!, products);
      const items = plan.items.filter((i) => i.qty > 0);
      if (items.length === 0) continue;

      const covered = wallets.get(customerId)!.availablePaise >= plan.totalPaise;
      const [delivery] = await tx
        .insert(deliveries)
        .values({
          date,
          customerId,
          routeId: address.routeId,
          routePosition: address.routePosition,
          totalPaise: plan.totalPaise,
          status: covered ? 'pending' : 'skipped_low_balance',
        })
        .returning({ id: deliveries.id });
      await tx.insert(deliveryItems).values(
        items.map((i) => ({
          deliveryId: delivery!.id,
          productId: i.productId,
          qty: i.qty,
          unitPricePaise: products.get(i.productId)!.pricePaise,
        })),
      );
      if (covered) created++;
      else skippedLowBalance++;
    }
    return { date, alreadyLocked: false, created, skippedLowBalance };
  });
}

/** Locks today (if it was missed) and tomorrow once its cutoff has passed. Safe to call repeatedly. */
export async function lockDueDates(db: Db, now: Date): Promise<LockResult[]> {
  const today = todayInIst(now);
  const tomorrow = addDays(today, 1);
  const [{ orderCutoffTime }, locked] = await Promise.all([getSettings(db), loadLockedDates(db, today, tomorrow)]);
  const results: LockResult[] = [];
  for (const date of [today, tomorrow]) {
    if (locked.has(date)) continue;
    if (date === today || isPastCutoff(date, orderCutoffTime, now)) {
      const result = await lockDate(db, date, now);
      if (!result.alreadyLocked) results.push(result);
    }
  }
  return results;
}
