import { z } from 'zod';

import { isIsoDate, isTimeOfDay, type IsoDate } from './dates';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ROLES = ['customer', 'delivery', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const DELIVERY_STATUSES = ['pending', 'delivered', 'not_delivered', 'skipped_low_balance'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const NOT_DELIVERED_REASONS = ['door_locked', 'customer_refused', 'other'] as const;
export type NotDeliveredReason = (typeof NOT_DELIVERED_REASONS)[number];

export const WALLET_TXN_TYPES = ['topup', 'delivery', 'adjustment'] as const;
export type WalletTxnType = (typeof WALLET_TXN_TYPES)[number];

/** Upper bound on units of one product per day, to catch typos. */
export const MAX_DAILY_QTY = 20;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
}

export interface Address {
  line1: string;
  line2: string;
  area: string;
  landmark: string;
}

export interface Me extends User {
  address: Address | null;
  routeName: string | null;
}

export interface Product {
  id: number;
  name: string;
  unitLabel: string;
  pricePaise: number;
  active: boolean;
}

export interface Subscription {
  productId: number;
  defaultQty: number;
}

export interface Pause {
  id: number;
  startDate: IsoDate;
  /** `null` means paused until the customer resumes. */
  endDate: IsoDate | null;
}

export interface DayItem {
  productId: number;
  qty: number;
  /** True when the customer changed this day away from their usual quantity. */
  changed: boolean;
}

/**
 * One calendar day from the customer's point of view.
 * - `planned`: not locked yet, computed from subscriptions, pauses and day changes.
 * - a delivery status: locked, with the recorded delivery.
 * - `none`: locked, nothing was scheduled.
 */
export type DayStatus = 'planned' | 'none' | DeliveryStatus;

export interface Day {
  date: IsoDate;
  editable: boolean;
  paused: boolean;
  status: DayStatus;
  items: DayItem[];
  totalPaise: number;
}

export interface Schedule {
  days: Day[];
}

export interface WalletTxn {
  id: number;
  amountPaise: number;
  type: WalletTxnType;
  note: string;
  deliveryDate: IsoDate | null;
  createdAt: string;
}

export interface WalletSummary {
  balancePaise: number;
  /** Balance minus deliveries that are locked but not yet delivered. */
  availablePaise: number;
}

export interface Wallet extends WalletSummary {
  transactions: WalletTxn[];
}

export interface AppSettings {
  /** `HH:MM` IST on the day before delivery. */
  orderCutoffTime: string;
  /** `HH:MM` IST, shown to customers as "delivered by". */
  deliveryTime: string;
}

export interface CustomerHome {
  me: Me;
  settings: AppSettings;
  wallet: WalletSummary;
  /** Next day the customer can still change. */
  nextDay: Day;
  /** Set when the wallet won't cover `nextDay`. */
  shortfallPaise: number | null;
  activePause: Pause | null;
}

export interface LineItem {
  productId: number;
  name: string;
  unitLabel: string;
  qty: number;
}

export interface Drop {
  id: number;
  customerName: string;
  phone: string | null;
  address: Address | null;
  routeName: string | null;
  routePosition: number | null;
  items: LineItem[];
  status: DeliveryStatus;
  reason: NotDeliveredReason | null;
}

export interface DeliveryRun {
  date: IsoDate;
  locked: boolean;
  totals: LineItem[];
  drops: Drop[];
}

export interface RouteProgress {
  routeId: number;
  routeName: string;
  deliveryUserName: string | null;
  total: number;
  delivered: number;
  notDelivered: number;
}

export interface CustomerBalanceAlert {
  id: number;
  name: string;
  phone: string | null;
  balancePaise: number;
  shortfallPaise: number;
}

export interface AdminDashboard {
  tomorrow: { date: IsoDate; locked: boolean; totals: LineItem[] };
  today: { date: IsoDate; routes: RouteProgress[]; skippedLowBalance: number };
  lowBalanceCustomers: CustomerBalanceAlert[];
  unroutedCustomers: { id: number; name: string }[];
}

export interface CustomerSummary {
  id: number;
  name: string;
  /** Admins appear too, since they can order for themselves. */
  role: Role;
  phone: string | null;
  area: string | null;
  routeName: string | null;
  balancePaise: number;
}

export interface CustomerDetail {
  user: User;
  address: Address | null;
  routeId: number | null;
  routePosition: number | null;
  subscriptions: Subscription[];
  wallet: Wallet;
}

export interface Route {
  id: number;
  name: string;
  deliveryUserId: number | null;
  deliveryUserName: string | null;
  customerCount: number;
}

export interface AuthConfig {
  /** Google OAuth web client ID, or null when Google sign-in isn't set up. */
  googleWebClientId: string | null;
  /** Whether the development user picker is available. */
  devSignIn: boolean;
}

export interface SignInResult {
  token: string;
  user: User;
}

export interface LockResult {
  date: IsoDate;
  alreadyLocked: boolean;
  created: number;
  skippedLowBalance: number;
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

const isoDate = z.string().refine(isIsoDate, 'Expected a date as YYYY-MM-DD');
const timeOfDay = z.string().refine(isTimeOfDay, 'Expected a time as HH:MM');
const trimmed = (max: number) => z.string().trim().max(max);
const phone = z
  .string()
  .trim()
  .regex(/^\+?\d{10,13}$/, 'Enter a valid mobile number');

export const addressInput = z.object({
  line1: trimmed(200).min(1, 'Required'),
  line2: trimmed(200).default(''),
  area: trimmed(100).min(1, 'Required'),
  landmark: trimmed(200).default(''),
});

export const profileInput = z.object({
  name: trimmed(100).min(1, 'Required'),
  phone,
  address: addressInput,
});
export type ProfileInput = z.input<typeof profileInput>;

export const subscriptionInput = z.object({
  defaultQty: z.number().int().min(1).max(MAX_DAILY_QTY),
});

export const dayQtyInput = z.object({
  qty: z.number().int().min(0).max(MAX_DAILY_QTY),
});

export const pauseInput = z
  .object({ startDate: isoDate, endDate: isoDate.nullable() })
  .refine((p) => p.endDate === null || p.endDate >= p.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
export type PauseInput = z.infer<typeof pauseInput>;

export const markDeliveryInput = z
  .object({
    status: z.enum(['pending', 'delivered', 'not_delivered']),
    reason: z.enum(NOT_DELIVERED_REASONS).nullable().default(null),
  })
  .refine((m) => (m.status === 'not_delivered') === (m.reason !== null), {
    message: 'A reason is required only when not delivered',
    path: ['reason'],
  });
export type MarkDeliveryInput = z.input<typeof markDeliveryInput>;

export const walletCreditInput = z.object({
  amountPaise: z.number().int().refine((n) => n !== 0, 'Amount cannot be zero'),
  note: trimmed(200).min(1, 'Add a note, e.g. "Cash"'),
});
export type WalletCreditInput = z.infer<typeof walletCreditInput>;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email'));

/** Adding or editing a person. Their Google account email lets them sign in. */
export const userInput = z.object({
  name: trimmed(100).min(1, 'Required'),
  phone: phone.nullable().default(null),
  email: email.nullable().default(null),
  role: z.enum(ROLES),
});
export type UserInput = z.input<typeof userInput>;

export const googleSignInInput = z.object({ idToken: z.string().min(1) });

export const roleInput = z.object({ role: z.enum(ROLES) });

export const routeInput = z.object({
  name: trimmed(100).min(1, 'Required'),
  deliveryUserId: z.number().int().nullable(),
});
export type RouteInput = z.infer<typeof routeInput>;

export const assignRouteInput = z.object({
  routeId: z.number().int().nullable(),
  routePosition: z.number().int().min(1).nullable(),
});
export type AssignRouteInput = z.infer<typeof assignRouteInput>;

export const productInput = z.object({
  name: trimmed(100).min(1, 'Required'),
  unitLabel: trimmed(30).min(1, 'Required'),
  pricePaise: z.number().int().min(1),
  active: z.boolean(),
});
export type ProductInput = z.infer<typeof productInput>;

export const settingsInput = z.object({
  // Kept in the afternoon/evening so it always reads as "the evening before delivery".
  orderCutoffTime: timeOfDay.refine((t) => t >= '12:00', 'Cutoff must be between 12:00 and 23:59'),
  deliveryTime: timeOfDay,
});

export const lockInput = z.object({ date: isoDate });
