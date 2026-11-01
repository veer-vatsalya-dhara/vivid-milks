import {
  addDays,
  firstEditableDate,
  todayInIst,
  type AdminDashboard,
  type AssignRouteInput,
  type CustomerDetail,
  type CustomerSummary,
  type LineItem,
  type Product,
  type ProductInput,
  type Role,
  type Route,
  type RouteInput,
  type User,
  type userInput,
} from '@vivid-milks/shared';
import { and, asc, eq, gte, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../db/client';
import { toUser } from '../auth';
import {
  addresses,
  dayOverrides,
  deliveries,
  deliveryItems,
  pauses,
  products,
  routes,
  subscriptions,
  users,
} from '../db/schema';
import { badRequest, conflict, notFound } from '../errors';
import { customersWithOrders, loadLockedDates, loadPlanInputs, loadProducts, loadWalletSummaries } from './data';
import { getSubscriptions } from './customer';
import { sumLineItems } from './deliveries';
import { planDay } from './planner';
import { getSettings } from './settings';
import { getWallet } from './wallet';

async function routedAddresses(db: Db, customerIds: number[]) {
  if (customerIds.length === 0) return new Map<number, typeof addresses.$inferSelect>();
  const rows = await db.select().from(addresses).where(inArray(addresses.userId, customerIds));
  return new Map(rows.map((a) => [a.userId, a]));
}

export async function getDashboard(db: Db, now: Date): Promise<AdminDashboard> {
  const today = todayInIst(now);
  const tomorrow = addDays(today, 1);
  const { orderCutoffTime } = await getSettings(db);
  const nextOpen = firstEditableDate(orderCutoffTime, now);
  const [products, lockedDates] = await Promise.all([loadProducts(db), loadLockedDates(db, tomorrow, tomorrow)]);
  const tomorrowLocked = lockedDates.has(tomorrow);

  // Projected orders for routed customers, for tomorrow (if still open) and the next open date.
  const customerIds = await customersWithOrders(db, tomorrow, nextOpen);
  const [inputs, addressByCustomer, wallets] = await Promise.all([
    loadPlanInputs(db, customerIds, tomorrow, nextOpen),
    routedAddresses(db, customerIds),
    loadWalletSummaries(db, customerIds, today),
  ]);
  const routedIds = customerIds.filter((id) => addressByCustomer.get(id)?.routeId);

  let tomorrowTotals: LineItem[];
  if (tomorrowLocked) {
    const rows = await db
      .select({ productId: deliveryItems.productId, qty: sql<number>`sum(${deliveryItems.qty})::int` })
      .from(deliveryItems)
      .innerJoin(deliveries, eq(deliveries.id, deliveryItems.deliveryId))
      .where(and(eq(deliveries.date, tomorrow), ne(deliveries.status, 'skipped_low_balance')))
      .groupBy(deliveryItems.productId);
    tomorrowTotals = rows.map((r) => toLineItem(products, r.productId, r.qty));
  } else {
    tomorrowTotals = sumLineItems(
      routedIds.flatMap((id) =>
        planDay(tomorrow, inputs.get(id)!, products)
          .items.filter((i) => i.qty > 0)
          .map((i) => toLineItem(products, i.productId, i.qty)),
      ),
    );
  }

  const progressRows = await db
    .select({
      routeId: routes.id,
      routeName: routes.name,
      deliveryUserName: users.name,
      total: sql<number>`count(${deliveries.id})::int`,
      delivered: sql<number>`count(*) filter (where ${deliveries.status} = 'delivered')::int`,
      notDelivered: sql<number>`count(*) filter (where ${deliveries.status} = 'not_delivered')::int`,
    })
    .from(deliveries)
    .innerJoin(routes, eq(routes.id, deliveries.routeId))
    .leftJoin(users, eq(users.id, routes.deliveryUserId))
    .where(and(eq(deliveries.date, today), ne(deliveries.status, 'skipped_low_balance')))
    .groupBy(routes.id, routes.name, users.name)
    .orderBy(asc(routes.name));

  const [skipped] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(and(eq(deliveries.date, today), eq(deliveries.status, 'skipped_low_balance')));

  const namesById = await userNames(db, customerIds);
  const lowBalanceCustomers = routedIds.flatMap((id) => {
    const cost = planDay(nextOpen, inputs.get(id)!, products).totalPaise;
    const wallet = wallets.get(id)!;
    const shortfall = cost - wallet.availablePaise;
    if (cost === 0 || shortfall <= 0) return [];
    const user = namesById.get(id)!;
    return [{ id, name: user.name, phone: user.phone, balancePaise: wallet.balancePaise, shortfallPaise: shortfall }];
  });

  const unroutedCustomers = customerIds
    .filter((id) => !addressByCustomer.get(id)?.routeId)
    .map((id) => ({ id, name: namesById.get(id)!.name }));

  return {
    tomorrow: { date: tomorrow, locked: tomorrowLocked, totals: tomorrowTotals },
    today: { date: today, routes: progressRows, skippedLowBalance: skipped?.count ?? 0 },
    lowBalanceCustomers,
    unroutedCustomers,
  };
}

function toLineItem(products: Map<number, Product>, productId: number, qty: number): LineItem {
  const p = products.get(productId);
  return { productId, name: p?.name ?? 'Unknown', unitLabel: p?.unitLabel ?? '', qty };
}

async function userNames(db: Db, ids: number[]) {
  if (ids.length === 0) return new Map<number, { name: string; phone: string | null }>();
  const rows = await db
    .select({ id: users.id, name: users.name, phone: users.phone })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Customers and admins (admins can order for themselves too). */
export async function listCustomers(db: Db, query: string, now: Date): Promise<CustomerSummary[]> {
  const q = query.trim();
  const rows = await db
    .select({ user: users, area: addresses.area, routeName: routes.name })
    .from(users)
    .leftJoin(addresses, eq(addresses.userId, users.id))
    .leftJoin(routes, eq(routes.id, addresses.routeId))
    .where(
      and(
        ne(users.role, 'delivery'),
        isNull(users.removedAt),
        q ? or(ilike(users.name, `%${q}%`), ilike(users.phone, `%${q}%`), ilike(addresses.area, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(asc(users.name))
    .limit(200);
  const wallets = await loadWalletSummaries(
    db,
    rows.map((r) => r.user.id),
    todayInIst(now),
  );
  return rows.map(({ user, area, routeName }) => ({
    id: user.id,
    name: user.name,
    role: user.role,
    phone: user.phone,
    area,
    routeName,
    balancePaise: wallets.get(user.id)!.balancePaise,
  }));
}

export async function getCustomerDetail(db: Db, customerId: number, now: Date): Promise<CustomerDetail> {
  const [row] = await db
    .select({ user: users, address: addresses })
    .from(users)
    .leftJoin(addresses, eq(addresses.userId, users.id))
    .where(eq(users.id, customerId));
  if (!row) throw notFound('Customer');
  const { user, address } = row;
  return {
    user: toUser(user),
    address: address && { line1: address.line1, line2: address.line2, area: address.area, landmark: address.landmark },
    routeId: address?.routeId ?? null,
    routePosition: address?.routePosition ?? null,
    subscriptions: await getSubscriptions(db, customerId),
    wallet: await getWallet(db, customerId, now),
  };
}

export async function assignRoute(db: Db, customerId: number, input: AssignRouteInput, now: Date) {
  const [address] = await db.select().from(addresses).where(eq(addresses.userId, customerId));
  if (!address) throw conflict('Add the customer’s address before assigning a route');
  if (input.routeId !== null) {
    const [route] = await db.select().from(routes).where(eq(routes.id, input.routeId));
    if (!route) throw notFound('Route');
  }
  await db
    .update(addresses)
    .set({ routeId: input.routeId, routePosition: input.routeId === null ? null : input.routePosition })
    .where(eq(addresses.userId, customerId));
  return getCustomerDetail(db, customerId, now);
}

// ---------------------------------------------------------------------------
// Users and roles
// ---------------------------------------------------------------------------

/** Everyone who hasn't been removed. */
export async function listUsers(db: Db): Promise<User[]> {
  const rows = await db.select().from(users).where(isNull(users.removedAt)).orderBy(asc(users.name));
  return rows.map(toUser);
}

async function assertEmailFree(db: Db, email: string | null, exceptId?: number) {
  if (!email) return;
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing && existing.id !== exceptId && !existing.removedAt) {
    throw conflict(`${existing.name} already uses ${email}`);
  }
}

/** Adds a person. Re-adding a removed person's email brings their account back. */
export async function createUser(db: Db, input: z.output<typeof userInput>): Promise<User> {
  await assertEmailFree(db, input.email);
  if (input.email) {
    const [removed] = await db.select().from(users).where(eq(users.email, input.email));
    if (removed) {
      const [restored] = await db
        .update(users)
        .set({ ...input, removedAt: null })
        .where(eq(users.id, removed.id))
        .returning();
      return toUser(restored!);
    }
  }
  const [user] = await db.insert(users).values(input).returning();
  return toUser(user!);
}

async function activeUser(db: Db, userId: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.removedAt)));
  if (!user) throw notFound('Person');
  return user;
}

async function assertAnotherAdmin(db: Db, userId: number) {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.removedAt), ne(users.id, userId)));
  if (count === 0) throw badRequest('There must be at least one admin');
}

/** Edits a person's details and role. */
export async function updateUser(
  db: Db,
  adminId: number,
  userId: number,
  input: z.output<typeof userInput>,
): Promise<User> {
  const user = await activeUser(db, userId);
  if (userId === adminId && input.role !== 'admin') throw badRequest('You cannot remove your own admin role');
  if (user.role === 'admin' && input.role !== 'admin') await assertAnotherAdmin(db, userId);
  await assertEmailFree(db, input.email, userId);

  const [updated] = await db.update(users).set(input).where(eq(users.id, userId)).returning();
  if (input.role !== 'delivery') {
    await db.update(routes).set({ deliveryUserId: null }).where(eq(routes.deliveryUserId, userId));
  }
  return toUser(updated!);
}

export async function setRole(db: Db, adminId: number, userId: number, role: Role): Promise<User> {
  const user = await activeUser(db, userId);
  return updateUser(db, adminId, userId, { name: user.name, email: user.email, phone: user.phone, role });
}

/**
 * Removes a person: they can no longer sign in, their subscriptions, upcoming day changes
 * and upcoming deliveries stop, and they leave their route. Past deliveries and wallet
 * history are kept.
 */
export async function removeUser(db: Db, adminId: number, userId: number, now: Date): Promise<void> {
  if (userId === adminId) throw badRequest('You cannot remove yourself');
  const user = await activeUser(db, userId);
  if (user.role === 'admin') await assertAnotherAdmin(db, userId);
  const today = todayInIst(now);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ removedAt: now }).where(eq(users.id, userId));
    await tx.delete(subscriptions).where(eq(subscriptions.customerId, userId));
    await tx.delete(pauses).where(eq(pauses.customerId, userId));
    await tx.delete(dayOverrides).where(and(eq(dayOverrides.customerId, userId), gte(dayOverrides.date, today)));
    await tx
      .delete(deliveries)
      .where(
        and(
          eq(deliveries.customerId, userId),
          gte(deliveries.date, today),
          inArray(deliveries.status, ['pending', 'skipped_low_balance']),
        ),
      );
    await tx.update(addresses).set({ routeId: null, routePosition: null }).where(eq(addresses.userId, userId));
    await tx.update(routes).set({ deliveryUserId: null }).where(eq(routes.deliveryUserId, userId));
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function listRoutes(db: Db): Promise<Route[]> {
  return db
    .select({
      id: routes.id,
      name: routes.name,
      deliveryUserId: routes.deliveryUserId,
      deliveryUserName: users.name,
      customerCount: sql<number>`(select count(*) from ${addresses} where ${addresses.routeId} = ${routes.id})::int`,
    })
    .from(routes)
    .leftJoin(users, eq(users.id, routes.deliveryUserId))
    .orderBy(asc(routes.name));
}

async function assertDeliveryUser(db: Db, userId: number | null) {
  if (userId === null) return;
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.removedAt)));
  if (!user) throw notFound('Delivery person');
  if (user.role === 'customer') throw badRequest(`${user.name} is not delivery staff`);
}

export async function createRoute(db: Db, input: RouteInput): Promise<Route[]> {
  await assertDeliveryUser(db, input.deliveryUserId);
  await db.insert(routes).values(input);
  return listRoutes(db);
}

export async function updateRoute(db: Db, routeId: number, input: RouteInput): Promise<Route[]> {
  await assertDeliveryUser(db, input.deliveryUserId);
  const updated = await db.update(routes).set(input).where(eq(routes.id, routeId)).returning();
  if (updated.length === 0) throw notFound('Route');
  return listRoutes(db);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listAllProducts(db: Db): Promise<Product[]> {
  return [...(await loadProducts(db)).values()];
}

export async function createProduct(db: Db, input: ProductInput): Promise<Product[]> {
  await db.insert(products).values(input);
  return listAllProducts(db);
}

export async function updateProduct(db: Db, productId: number, input: ProductInput): Promise<Product[]> {
  const updated = await db.update(products).set(input).where(eq(products.id, productId)).returning();
  if (updated.length === 0) throw notFound('Product');
  return listAllProducts(db);
}
