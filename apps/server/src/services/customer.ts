import {
  addDays,
  dateRange,
  firstEditableDate,
  isPastCutoff,
  todayInIst,
  type CustomerHome,
  type Day,
  type IsoDate,
  type Me,
  type Pause,
  type PauseInput,
  type profileInput,
  type Subscription,
} from '@vivid-milks/shared';
import type { z } from 'zod';
import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';

import type { Db } from '../db/client';
import { addresses, dayOverrides, deliveries, deliveryItems, pauses, routes, subscriptions, users } from '../db/schema';
import { badRequest, conflict, notFound } from '../errors';
import { loadLockedDates, loadPlanInputs, loadProducts, loadWalletSummaries } from './data';
import { baselineQty, planDay } from './planner';
import { getSettings } from './settings';

const MAX_SCHEDULE_DAYS = 62;

export async function getMe(db: Db, userId: number): Promise<Me> {
  const [row] = await db
    .select({ user: users, address: addresses, routeName: routes.name })
    .from(users)
    .leftJoin(addresses, eq(addresses.userId, users.id))
    .leftJoin(routes, eq(routes.id, addresses.routeId))
    .where(eq(users.id, userId));
  if (!row) throw notFound('User');
  const { user, address } = row;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    address: address && { line1: address.line1, line2: address.line2, area: address.area, landmark: address.landmark },
    routeName: row.routeName,
  };
}

export async function updateProfile(db: Db, userId: number, input: z.output<typeof profileInput>): Promise<Me> {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: input.name, phone: input.phone }).where(eq(users.id, userId));
    await tx
      .insert(addresses)
      .values({ userId, ...input.address })
      .onConflictDoUpdate({ target: addresses.userId, set: input.address });
  });
  return getMe(db, userId);
}

export async function getSchedule(db: Db, customerId: number, from: IsoDate, to: IsoDate, now: Date): Promise<Day[]> {
  if (to < from) throw badRequest('`to` must be on or after `from`');
  if (dateRange(from, to).length > MAX_SCHEDULE_DAYS) throw badRequest(`At most ${MAX_SCHEDULE_DAYS} days at a time`);

  const [settings, products, inputsByCustomer, lockedDates, deliveryRows] = await Promise.all([
    getSettings(db),
    loadProducts(db),
    loadPlanInputs(db, [customerId], from, to),
    loadLockedDates(db, from, to),
    db
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.customerId, customerId), gte(deliveries.date, from), lte(deliveries.date, to))),
  ]);
  const inputs = inputsByCustomer.get(customerId)!;
  const itemRows = deliveryRows.length
    ? await db
        .select()
        .from(deliveryItems)
        .where(
          inArray(
            deliveryItems.deliveryId,
            deliveryRows.map((d) => d.id),
          ),
        )
    : [];
  const deliveryByDate = new Map(deliveryRows.map((d) => [d.date, d]));
  const today = todayInIst(now);

  return dateRange(from, to).map((date): Day => {
    const planned = planDay(date, inputs, products);
    const delivery = deliveryByDate.get(date);
    if (delivery) {
      return {
        date,
        editable: false,
        paused: planned.paused,
        status: delivery.status,
        items: itemRows
          .filter((i) => i.deliveryId === delivery.id)
          .map((i) => ({ productId: i.productId, qty: i.qty, changed: false })),
        totalPaise: delivery.totalPaise,
      };
    }
    if (date < today || lockedDates.has(date)) {
      return { date, editable: false, paused: planned.paused, status: 'none', items: [], totalPaise: 0 };
    }
    const editable = date > today && !isPastCutoff(date, settings.orderCutoffTime, now);
    return { date, editable, status: 'planned', ...planned };
  });
}

async function getDay(db: Db, customerId: number, date: IsoDate, now: Date): Promise<Day> {
  const [day] = await getSchedule(db, customerId, date, date, now);
  return day!;
}

async function assertEditable(db: Db, date: IsoDate, now: Date): Promise<void> {
  const { orderCutoffTime } = await getSettings(db);
  const first = firstEditableDate(orderCutoffTime, now);
  if (date < first) throw conflict(`Orders for ${date} can no longer be changed`);
  if ((await loadLockedDates(db, date, date)).has(date)) throw conflict(`Orders for ${date} are already locked`);
}

/** Sets one product's quantity for one day. Setting it back to the usual quantity removes the change. */
export async function setDayQty(
  db: Db,
  customerId: number,
  date: IsoDate,
  productId: number,
  qty: number,
  now: Date,
): Promise<Day> {
  await assertEditable(db, date, now);
  const product = (await loadProducts(db)).get(productId);
  if (!product?.active) throw notFound('Product');

  const inputs = (await loadPlanInputs(db, [customerId], date, date)).get(customerId)!;
  const key = and(
    eq(dayOverrides.customerId, customerId),
    eq(dayOverrides.productId, productId),
    eq(dayOverrides.date, date),
  );
  if (qty === baselineQty(date, productId, inputs)) {
    await db.delete(dayOverrides).where(key);
  } else {
    await db
      .insert(dayOverrides)
      .values({ customerId, productId, date, qty })
      .onConflictDoUpdate({ target: [dayOverrides.customerId, dayOverrides.productId, dayOverrides.date], set: { qty } });
  }
  return getDay(db, customerId, date, now);
}

export async function getSubscriptions(db: Db, customerId: number): Promise<Subscription[]> {
  return db
    .select({ productId: subscriptions.productId, defaultQty: subscriptions.defaultQty })
    .from(subscriptions)
    .where(eq(subscriptions.customerId, customerId))
    .orderBy(asc(subscriptions.productId));
}

export async function setSubscription(
  db: Db,
  customerId: number,
  productId: number,
  defaultQty: number,
): Promise<Subscription[]> {
  const product = (await loadProducts(db)).get(productId);
  if (!product?.active) throw notFound('Product');
  await db
    .insert(subscriptions)
    .values({ customerId, productId, defaultQty })
    .onConflictDoUpdate({ target: [subscriptions.customerId, subscriptions.productId], set: { defaultQty } });
  return getSubscriptions(db, customerId);
}

export async function removeSubscription(db: Db, customerId: number, productId: number): Promise<Subscription[]> {
  await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.customerId, customerId), eq(subscriptions.productId, productId)));
  return getSubscriptions(db, customerId);
}

/** The pause covering today or the nearest future pause. */
export async function getActivePause(db: Db, customerId: number, now: Date): Promise<Pause | null> {
  const today = todayInIst(now);
  const [row] = await db
    .select({ id: pauses.id, startDate: pauses.startDate, endDate: pauses.endDate })
    .from(pauses)
    .where(and(eq(pauses.customerId, customerId), or(isNull(pauses.endDate), gte(pauses.endDate, today))))
    .orderBy(asc(pauses.startDate))
    .limit(1);
  return row ?? null;
}

/**
 * Ends any current or upcoming pause from `from` onwards: pauses starting on or after `from`
 * are removed, and one already running is cut short to end the day before.
 */
async function clearPausesFrom(db: Db, customerId: number, from: IsoDate): Promise<void> {
  const open = await db
    .select()
    .from(pauses)
    .where(and(eq(pauses.customerId, customerId), or(isNull(pauses.endDate), gte(pauses.endDate, from))));
  for (const p of open) {
    if (p.startDate >= from) await db.delete(pauses).where(eq(pauses.id, p.id));
    else await db.update(pauses).set({ endDate: addDays(from, -1) }).where(eq(pauses.id, p.id));
  }
}

/** Replaces any current or upcoming pause with this one. */
export async function createPause(db: Db, customerId: number, input: PauseInput, now: Date): Promise<Pause | null> {
  const { orderCutoffTime } = await getSettings(db);
  const first = firstEditableDate(orderCutoffTime, now);
  if (input.startDate < first) throw conflict(`A pause can start from ${first} at the earliest`);

  await db.transaction(async (tx) => {
    await clearPausesFrom(tx, customerId, input.startDate);
    await tx.insert(pauses).values({ customerId, startDate: input.startDate, endDate: input.endDate });
  });
  return getActivePause(db, customerId, now);
}

/** Resumes deliveries from the first day that can still be changed. */
export async function endPause(db: Db, customerId: number, now: Date): Promise<Pause | null> {
  const { orderCutoffTime } = await getSettings(db);
  await clearPausesFrom(db, customerId, firstEditableDate(orderCutoffTime, now));
  return getActivePause(db, customerId, now);
}

export async function getCustomerHome(db: Db, customerId: number, now: Date): Promise<CustomerHome> {
  const settings = await getSettings(db);
  const nextDate = firstEditableDate(settings.orderCutoffTime, now);
  const [me, wallets, nextDay, activePause] = await Promise.all([
    getMe(db, customerId),
    loadWalletSummaries(db, [customerId], todayInIst(now)),
    getDay(db, customerId, nextDate, now),
    getActivePause(db, customerId, now),
  ]);
  const wallet = wallets.get(customerId)!;
  const shortfall = nextDay.totalPaise - wallet.availablePaise;
  return { me, settings, wallet, nextDay, shortfallPaise: shortfall > 0 ? shortfall : null, activePause };
}
