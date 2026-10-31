import type { Day } from '@vivid-milks/shared';

import { DAY_STATUS_LABELS } from './format';

type Tone = 'default' | 'info' | 'success' | 'warning' | 'danger';

export function dayBadge(day: Day): { label: string; tone: Tone } {
  if (day.status === 'planned' && day.paused && day.totalPaise === 0) return { label: 'Paused', tone: 'warning' };
  if (day.status === 'planned' && day.totalPaise === 0) return { label: 'Nothing scheduled', tone: 'default' };
  const tone: Record<Day['status'], Tone> = {
    planned: 'info',
    none: 'default',
    pending: 'info',
    delivered: 'success',
    not_delivered: 'danger',
    skipped_low_balance: 'danger',
  };
  return { label: DAY_STATUS_LABELS[day.status], tone: tone[day.status] };
}
