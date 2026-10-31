/**
 * Business dates are calendar dates in India Standard Time, written as `YYYY-MM-DD`.
 * IST is a fixed UTC+05:30 offset with no daylight saving, so plain offset maths is safe.
 */
export type IsoDate = string;

export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  return toUtcMs(value) !== undefined && new Date(toUtcMs(value)!).toISOString().startsWith(value);
}

/** `HH:MM`, 24-hour. */
export function isTimeOfDay(value: string): boolean {
  return TIME_RE.test(value);
}

function toUtcMs(date: IsoDate): number | undefined {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return Date.UTC(y, m - 1, d);
}

export function todayInIst(now: Date = new Date()): IsoDate {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtcMs(date)! + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** The instant after which orders for `date` can no longer be changed: `cutoffTime` IST on the previous day. */
export function orderCutoffInstant(date: IsoDate, cutoffTime: string): Date {
  const [hh, mm] = cutoffTime.split(':').map(Number);
  const previousDayUtcMs = toUtcMs(addDays(date, -1))!;
  return new Date(previousDayUtcMs + ((hh ?? 0) * 60 + (mm ?? 0)) * 60 * 1000 - IST_OFFSET_MS);
}

/** Whether orders for `date` are past their cutoff. */
export function isPastCutoff(date: IsoDate, cutoffTime: string, now: Date = new Date()): boolean {
  return now.getTime() >= orderCutoffInstant(date, cutoffTime).getTime();
}

/** First date whose orders can still be changed. */
export function firstEditableDate(cutoffTime: string, now: Date = new Date()): IsoDate {
  let date = addDays(todayInIst(now), 1);
  while (isPastCutoff(date, cutoffTime, now)) date = addDays(date, 1);
  return date;
}

/** "10:00 PM" from "22:00". */
export function formatTimeOfDay(time: string): string {
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const suffix = hh < 12 ? 'AM' : 'PM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${String(mm).padStart(2, '0')} ${suffix}`;
}
