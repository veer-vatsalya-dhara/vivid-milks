import {
  DELIVERY_STATUSES,
  NOT_DELIVERED_REASONS,
  PAYMENT_METHODS,
  PAYMENT_REQUEST_STATUSES,
  ROLES,
  WALLET_TXN_TYPES,
} from '@vivid-milks/shared';
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
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const paymentRequestStatusEnum = pgEnum('payment_request_status', PAYMENT_REQUEST_STATUSES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  /** Lowercase. Used to match Google sign-ins to people added by an admin. */
  email: text('email').unique(),
  phone: text('phone'),
  role: roleEnum('role').notNull().default('customer'),
  /** Google account id, set on first Google sign-in. */
  googleSub: text('google_sub').unique(),
  /** Set when an admin removes the person. Removed people can't sign in; their history is kept. */
  removedAt: timestamp('removed_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const routes = pgTable('routes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  deliveryUserId: integer('delivery_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

/** Buildings and societies customers pick from. Admins manage the list. */
export const buildings = pgTable('buildings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  /** Blocks / towers, e.g. ["A", "B", "C"]. Empty when the building has none. */
  blocks: text('blocks').array().notNull().default([]),
  createdAt: createdAt(),
});

/** One delivery address per customer in the MVP. */
export const addresses = pgTable('addresses', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  buildingId: integer('building_id').references(() => buildings.id),
  block: text('block').notNull().default(''),
  /** 0 is the ground floor. */
  floor: integer('floor'),
  /** House / flat number. */
  line1: text('line1').notNull(),
  /** Free-text building name from before buildings were a list. */
  line2: text('line2').notNull().default(''),
  area: text('area').notNull().default(''),
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
  /** Deleted products are kept for order history but no longer listed anywhere. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
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

/** A customer's "I have paid" for an admin to approve. Approval adds the money to the wallet. */
export const paymentRequests = pgTable(
  'payment_requests',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id')
      .notNull()
      .references(() => users.id),
    amountPaise: integer('amount_paise').notNull(),
    method: paymentMethodEnum('method').notNull(),
    reference: text('reference').notNull().default(''),
    status: paymentRequestStatusEnum('status').notNull().default('pending'),
    decidedBy: integer('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    walletTxnId: integer('wallet_txn_id').references(() => walletTxns.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.status), index().on(t.customerId)],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
