import { describe, expect, it } from 'vitest';

import {
  addDays,
  dateRange,
  firstEditableDate,
  formatTimeOfDay,
  isIsoDate,
  isPastCutoff,
  orderCutoffInstant,
  todayInIst,
} from './dates';
import { formatRupees } from './money';

describe('IST dates', () => {
  it('rolls over to the next day at 18:30 UTC', () => {
    expect(todayInIst(new Date('2026-10-31T18:29:59Z'))).toBe('2026-10-31');
    expect(todayInIst(new Date('2026-10-31T18:30:00Z'))).toBe('2026-11-01');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('validates dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
  });
});

describe('order cutoff', () => {
  it('is the cutoff time IST on the previous day', () => {
    // 22:00 IST on 31 Oct = 16:30 UTC.
    expect(orderCutoffInstant('2026-11-01', '22:00').toISOString()).toBe('2026-10-31T16:30:00.000Z');
  });

  it('locks a date exactly at the cutoff', () => {
    expect(isPastCutoff('2026-11-01', '22:00', new Date('2026-10-31T16:29:59Z'))).toBe(false);
    expect(isPastCutoff('2026-11-01', '22:00', new Date('2026-10-31T16:30:00Z'))).toBe(true);
  });

  it('finds the first editable date', () => {
    // 9 PM IST on 31 Oct: 1 Nov is still open.
    expect(firstEditableDate('22:00', new Date('2026-10-31T15:30:00Z'))).toBe('2026-11-01');
    // 11 PM IST on 31 Oct: 1 Nov is locked.
    expect(firstEditableDate('22:00', new Date('2026-10-31T17:30:00Z'))).toBe('2026-11-02');
    // 11:59 PM cutoff, checked at 11:58 PM IST on 31 Oct: 1 Nov is still open.
    expect(firstEditableDate('23:59', new Date('2026-10-31T18:28:00Z'))).toBe('2026-11-01');
  });
});

describe('formatting', () => {
  it('formats times and rupees', () => {
    expect(formatTimeOfDay('22:00')).toBe('10:00 PM');
    expect(formatTimeOfDay('07:00')).toBe('7:00 AM');
    expect(formatTimeOfDay('00:15')).toBe('12:15 AM');
    expect(formatRupees(6800)).toBe('₹68');
    expect(formatRupees(3250)).toBe('₹32.50');
    expect(formatRupees(-500)).toBe('−₹5');
  });
});
