import type { AppSettings } from '@vivid-milks/shared';

import type { Db } from '../db/client';
import { settings } from '../db/schema';

const DEFAULTS: AppSettings = {
  orderCutoffTime: '22:00',
  deliveryTime: '07:00',
};

export async function getSettings(db: Db): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    orderCutoffTime: stored.orderCutoffTime ?? DEFAULTS.orderCutoffTime,
    deliveryTime: stored.deliveryTime ?? DEFAULTS.deliveryTime,
  };
}

export async function updateSettings(db: Db, values: AppSettings): Promise<AppSettings> {
  for (const [key, value] of Object.entries(values)) {
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  return getSettings(db);
}
