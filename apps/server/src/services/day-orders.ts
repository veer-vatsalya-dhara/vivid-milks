import { todayInIst, type DeliveryStatus, type IsoDate, type Product } from '@vivid-milks/shared';
import { eq, inArray } from 'drizzle-orm';

import type { Db } from '../db/client';
import { addresses, deliveries, deliveryItems } from '../db/schema';
import { customersWithOrders, loadLockedDates, loadPlanInputs, loadProducts, loadWalletSummaries } from './data';
import { planDay } from './planner';

export interface DayOrder {
  customerId: number;
  routeId: number | null;
  status: DeliveryStatus;
  items: { productId: number; qty: number; unitPricePaise: number }[];
  totalPaise: number;
}

export interface DayOrders {
  date: IsoDate;
  locked: boolean;
  products: Map<number, Product>;
  /** Every order for the day, including ones skipped for low balance. */
  orders: DayOrder[];
}

/**
 * Orders for `date`. Once locked, these are the recorded deliveries. Before that, they are
 * worked out the same way locking will: customers without an address get nothing, and those
 * whose available balance doesn't cover the order are marked `skipped_low_balance`.
 */
export async function getDayOrders(db: Db, date: IsoDate, now: Date): Promise<DayOrders> {
  const [products, lockedDates] = await Promise.all([loadProducts(db), loadLockedDates(db, date, date)]);
  const locked = lockedDates.has(date);

  if (locked) {
    const rows = await db.select().from(deliveries).where(eq(deliveries.date, date));
    const items = rows.length
      ? await db
          .select()
          .from(deliveryItems)
          .where(
            inArray(
              deliveryItems.deliveryId,
              rows.map((r) => r.id),
            ),
          )
      : [];
    return {
      date,
      locked,
      products,
      orders: rows.map((d) => ({
        customerId: d.customerId,
        routeId: d.routeId,
        status: d.status,
        totalPaise: d.totalPaise,
        items: items
          .filter((i) => i.deliveryId === d.id)
          .map((i) => ({ productId: i.productId, qty: i.qty, unitPricePaise: i.unitPricePaise })),
      })),
    };
  }

  const customerIds = await customersWithOrders(db, date, date);
  const [inputs, wallets, addressRows] = await Promise.all([
    loadPlanInputs(db, customerIds, date, date),
    loadWalletSummaries(db, customerIds, todayInIst(now)),
    customerIds.length ? db.select().from(addresses).where(inArray(addresses.userId, customerIds)) : [],
  ]);
  const addressByCustomer = new Map(addressRows.map((a) => [a.userId, a]));

  const orders: DayOrder[] = [];
  for (const customerId of customerIds) {
    const address = addressByCustomer.get(customerId);
    if (!address) continue;
    const routeId = address.routeId;
    const plan = planDay(date, inputs.get(customerId)!, products);
    const items = plan.items.filter((i) => i.qty > 0);
    if (items.length === 0) continue;
    const covered = wallets.get(customerId)!.availablePaise >= plan.totalPaise;
    orders.push({
      customerId,
      routeId,
      status: covered ? 'pending' : 'skipped_low_balance',
      totalPaise: plan.totalPaise,
      items: items.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        unitPricePaise: products.get(i.productId)!.pricePaise,
      })),
    });
  }
  return { date, locked, products, orders };
}

/** Orders that will actually be delivered (not skipped for low balance). */
export function deliverable(orders: DayOrder[]): DayOrder[] {
  return orders.filter((o) => o.status !== 'skipped_low_balance');
}
