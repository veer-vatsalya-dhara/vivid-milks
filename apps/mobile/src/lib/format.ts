import { addDays, todayInIst, type DayStatus, type IsoDate } from '@vivid-milks/shared';

export { formatRupees, formatTimeOfDay } from '@vivid-milks/shared';

function asUtcDate(date: IsoDate) {
  return new Date(`${date}T00:00:00Z`);
}

/** "Sun, 2 Nov" */
export function formatDay(date: IsoDate): string {
  return asUtcDate(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "Today", "Tomorrow" or "Sun, 2 Nov" */
export function formatRelativeDay(date: IsoDate, now = new Date()): string {
  const today = todayInIst(now);
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatDay(date);
}

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  planned: 'Scheduled',
  none: 'No delivery',
  pending: 'Confirmed',
  delivered: 'Delivered',
  not_delivered: 'Not delivered',
  skipped_low_balance: 'Skipped: low balance',
};

export const REASON_LABELS = {
  door_locked: 'Door locked',
  customer_refused: 'Customer refused',
  other: 'Other',
} as const;

export const ROLE_LABELS = { customer: 'Customer', delivery: 'Delivery', admin: 'Admin' } as const;
