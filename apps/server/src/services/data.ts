import type { IsoDate, Product, WalletSummary } from '@vivid-milks/shared';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { dayLocks, dayOverrides, deliveries, pauses, products, subscriptions, walletTxns } from '../db/schema';
import { emptyPlanInputs, type PlanInputs } from './planner';

export async function loadProducts(db: Db): Promise<Map<number, Product>> {
  const rows = await db.select().from(products).orderBy(products.id);
  return new Map(
    rows.map((p) => [p.id, { id: p.id, name: p.name, unitLabel: p.unitLabel, pricePaise: p.pricePaise, active: p.active }]),
  );
}

/** Subscriptions, pauses and day changes for each customer, with day changes limited to `from`..`to`. */
export async function loadPlanInputs(
  db: Db,
  customerIds: number[],
  from: IsoDate,
  to: IsoDate,
): Promise<Map<number, PlanInputs>> {
  const result = new Map<number, PlanInputs>(customerIds.map((id) => [id, emptyPlanInputs()]));
  if (customerIds.length === 0) return result;

  const [subRows, pauseRows, overrideRows] = await Promise.all([
    db.select().from(subscriptions).where(inArray(subscriptions.customerId, customerIds)),
    db.select().from(pauses).where(inArray(pauses.customerId, customerIds)),
    db
      .select()
      .from(dayOverrides)
      .where(and(inArray(dayOverrides.customerId, customerIds), gte(dayOverrides.date, from), lte(dayOverrides.date, to))),
  ]);

  for (const s of subRows) result.get(s.customerId)!.subscriptions.push({ productId: s.productId, defaultQty: s.defaultQty });
  for (const p of pauseRows) result.get(p.customerId)!.pauses.push({ startDate: p.startDate, endDate: p.endDate });
  for (const o of overrideRows) {
    const byDate = result.get(o.customerId)!.overrides;
    if (!byDate.has(o.date)) byDate.set(o.date, new Map());
    byDate.get(o.date)!.set(o.productId, o.qty);
  }
  return result;
}

/** Customers with anything that could produce an order between `from` and `to`. */
export async function customersWithOrders(db: Db, from: IsoDate, to: IsoDate): Promise<number[]> {
  const [subRows, overrideRows] = await Promise.all([
    db.selectDistinct({ id: subscriptions.customerId }).from(subscriptions),
    db
      .selectDistinct({ id: dayOverrides.customerId })
      .from(dayOverrides)
      .where(and(gte(dayOverrides.date, from), lte(dayOverrides.date, to), sql`${dayOverrides.qty} > 0`)),
  ]);
  return [...new Set([...subRows, ...overrideRows].map((r) => r.id))].sort((a, b) => a - b);
}

/**
 * Balance and available balance per customer. Available subtracts locked deliveries
 * from `today` on that haven't been delivered yet.
 */
export async function loadWalletSummaries(
  db: Db,
  customerIds: number[],
  today: IsoDate,
): Promise<Map<number, WalletSummary>> {
  const result = new Map<number, WalletSummary>(customerIds.map((id) => [id, { balancePaise: 0, availablePaise: 0 }]));
  if (customerIds.length === 0) return result;

  const [balances, pending] = await Promise.all([
    db
      .select({ id: walletTxns.customerId, total: sql<number>`coalesce(sum(${walletTxns.amountPaise}), 0)::int` })
      .from(walletTxns)
      .where(inArray(walletTxns.customerId, customerIds))
      .groupBy(walletTxns.customerId),
    db
      .select({ id: deliveries.customerId, total: sql<number>`coalesce(sum(${deliveries.totalPaise}), 0)::int` })
      .from(deliveries)
      .where(
        and(inArray(deliveries.customerId, customerIds), eq(deliveries.status, 'pending'), gte(deliveries.date, today)),
      )
      .groupBy(deliveries.customerId),
  ]);

  for (const b of balances) result.set(b.id, { balancePaise: b.total, availablePaise: b.total });
  for (const p of pending) {
    const w = result.get(p.id)!;
    w.availablePaise = w.balancePaise - p.total;
  }
  return result;
}

export async function loadLockedDates(db: Db, from: IsoDate, to: IsoDate): Promise<Set<IsoDate>> {
  const rows = await db
    .select({ date: dayLocks.date })
    .from(dayLocks)
    .where(and(gte(dayLocks.date, from), lte(dayLocks.date, to)));
  return new Set(rows.map((r) => r.date));
}
