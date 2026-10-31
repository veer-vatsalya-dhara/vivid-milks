import type { DayItem, IsoDate } from '@vivid-milks/shared';

export interface PlanProduct {
  id: number;
  pricePaise: number;
  active: boolean;
}

export interface PlanInputs {
  subscriptions: { productId: number; defaultQty: number }[];
  pauses: { startDate: IsoDate; endDate: IsoDate | null }[];
  /** date -> productId -> qty */
  overrides: Map<IsoDate, Map<number, number>>;
}

export interface PlannedDay {
  paused: boolean;
  items: DayItem[];
  totalPaise: number;
}

export function emptyPlanInputs(): PlanInputs {
  return { subscriptions: [], pauses: [], overrides: new Map() };
}

export function isPaused(date: IsoDate, inputs: PlanInputs): boolean {
  return inputs.pauses.some((p) => p.startDate <= date && (p.endDate === null || date <= p.endDate));
}

/** Quantity a product gets on `date` when the customer hasn't changed that day. */
export function baselineQty(date: IsoDate, productId: number, inputs: PlanInputs): number {
  if (isPaused(date, inputs)) return 0;
  return inputs.subscriptions.find((s) => s.productId === productId)?.defaultQty ?? 0;
}

/**
 * A customer's order for one day. Per product: a day change wins; otherwise 0 while
 * paused; otherwise the subscription's usual quantity. Inactive products are left out.
 */
export function planDay(date: IsoDate, inputs: PlanInputs, products: Map<number, PlanProduct>): PlannedDay {
  const paused = isPaused(date, inputs);
  const dayOverrides = inputs.overrides.get(date) ?? new Map<number, number>();
  const items: DayItem[] = [];

  for (const sub of inputs.subscriptions) {
    if (!products.get(sub.productId)?.active) continue;
    const base = paused ? 0 : sub.defaultQty;
    const override = dayOverrides.get(sub.productId);
    items.push({ productId: sub.productId, qty: override ?? base, changed: override !== undefined && override !== base });
  }

  // One-off additions of products the customer doesn't subscribe to.
  for (const [productId, qty] of dayOverrides) {
    if (qty === 0 || !products.get(productId)?.active) continue;
    if (inputs.subscriptions.some((s) => s.productId === productId)) continue;
    items.push({ productId, qty, changed: true });
  }

  items.sort((a, b) => a.productId - b.productId);
  const totalPaise = items.reduce((sum, i) => sum + i.qty * (products.get(i.productId)?.pricePaise ?? 0), 0);
  return { paused, items, totalPaise };
}
