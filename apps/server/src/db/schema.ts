import { DELIVERY_STATUSES, NOT_DELIVERED_REASONS, ROLES, WALLET_TXN_TYPES } from '@vivid-milks/shared';
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ROLES);
export const deliveryStatusEnum = pgEnum('delivery_status', DELIVERY_STATUSES);
export const notDeliveredReasonEnum = pgEnum('not_delivered_reason', NOT_DELIVERED_REASONS);
export const walletTxnTypeEnum = pgEnum('wallet_txn_type', WALLET_TXN_TYPES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique(),
  phone: text('phone'),
  role: roleEnum('role').notNull().default('customer'),
  createdAt: createdAt(),
});

export const routes = pgTable('routes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  deliveryUserId: integer('delivery_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

/** One delivery address per customer in the MVP. */
export const addresses = pgTable('addresses', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  line1: text('line1').notNull(),
  line2: text('line2').notNull().default(''),
  area: text('area').notNull(),
  landmark: text('landmark').notNull().default(''),
  routeId: integer('route_id').references(() => routes.id, { onDelete: 'set null' }),
  routePosition: integer('route_position'),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  unitLabel: text('unit_label').notNull(),
  pricePaise: integer('price_paise').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    defaultQty: integer('default_qty').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.customerId, t.productId)],
);

export const pauses = pgTable(
  'pauses',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    /** Null means paused until the customer resumes. */
    endDate: date('end_date', { mode: 'string' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.customerId)],
);

/** A customer's quantity for one product on one date, replacing their usual quantity. */
export const dayOverrides = pgTable(
  'day_overrides',
  {
    customerId: integer('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    date: date('date', { mode: 'string' }).notNull(),
    qty: integer('qty').notNull(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.productId, t.date] })],
);

/** Marks a date whose orders have been turned into deliveries. */
export const dayLocks = pgTable('day_locks', {
  date: date('date', { mode: 'string' }).primaryKey(),
  lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deliveries = pgTable(
  'deliveries',
  {
    id: serial('id').primaryKey(),
    date: date('date', { mode: 'string' }).notNull(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => users.id),
    routeId: integer('route_id').references(() => routes.id, { onDelete: 'set null' }),
    routePosition: integer('route_position'),
    totalPaise: integer('total_paise').notNull(),
    status: deliveryStatusEnum('status').notNull(),
    reason: notDeliveredReasonEnum('reason'),
    markedBy: integer('marked_by').references(() => users.id),
    markedAt: timestamp('marked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.customerId, t.date), index().on(t.date, t.routeId)],
);

export const deliveryItems = pgTable(
  'delivery_items',
  {
    deliveryId: integer('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    qty: integer('qty').notNull(),
    unitPricePaise: integer('unit_price_paise').notNull(),
  },
  (t) => [primaryKey({ columns: [t.deliveryId, t.productId] })],
);

/** Wallet ledger. Credits are positive, debits negative; balance is the sum. */
export const walletTxns = pgTable(
  'wallet_txns',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => users.id),
    amountPaise: integer('amount_paise').notNull(),
    type: walletTxnTypeEnum('type').notNull(),
    /** Set for delivery debits; at most one debit per delivery. */
    deliveryId: integer('delivery_id')
      .unique()
      .references(() => deliveries.id),
    note: text('note').notNull().default(''),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.customerId)],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
