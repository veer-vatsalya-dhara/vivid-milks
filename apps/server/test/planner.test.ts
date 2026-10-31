import { describe, expect, it } from 'vitest';

import { planDay, type PlanInputs, type PlanProduct } from '../src/services/planner';

const products = new Map<number, PlanProduct>([
  [1, { id: 1, pricePaise: 3400, active: true }],
  [2, { id: 2, pricePaise: 6600, active: true }],
  [3, { id: 3, pricePaise: 3000, active: false }],
]);

function inputs(partial: Partial<PlanInputs> = {}): PlanInputs {
  return { subscriptions: [], pauses: [], overrides: new Map(), ...partial };
}

describe('planDay', () => {
  it('uses the usual quantity', () => {
    const day = planDay('2026-11-01', inputs({ subscriptions: [{ productId: 1, defaultQty: 2 }] }), products);
    expect(day).toEqual({ paused: false, items: [{ productId: 1, qty: 2, changed: false }], totalPaise: 6800 });
  });

  it('applies a day change', () => {
    const day = planDay(
      '2026-11-01',
      inputs({
        subscriptions: [{ productId: 1, defaultQty: 2 }],
        overrides: new Map([['2026-11-01', new Map([[1, 3]])]]),
      }),
      products,
    );
    expect(day.items).toEqual([{ productId: 1, qty: 3, changed: true }]);
    expect(day.totalPaise).toBe(10200);
  });

  it('gives zero while paused, including open-ended pauses', () => {
    const subs = [{ productId: 1, defaultQty: 2 }];
    const ranged = inputs({ subscriptions: subs, pauses: [{ startDate: '2026-11-01', endDate: '2026-11-03' }] });
    expect(planDay('2026-10-31', ranged, products).totalPaise).toBe(6800);
    expect(planDay('2026-11-03', ranged, products)).toMatchObject({ paused: true, totalPaise: 0 });
    expect(planDay('2026-11-04', ranged, products).totalPaise).toBe(6800);

    const open = inputs({ subscriptions: subs, pauses: [{ startDate: '2026-11-01', endDate: null }] });
    expect(planDay('2027-01-01', open, products).paused).toBe(true);
  });

  it('lets a day change override a pause', () => {
    const day = planDay(
      '2026-11-02',
      inputs({
        subscriptions: [{ productId: 1, defaultQty: 2 }],
        pauses: [{ startDate: '2026-11-01', endDate: null }],
        overrides: new Map([['2026-11-02', new Map([[1, 1]])]]),
      }),
      products,
    );
    expect(day).toMatchObject({ paused: true, totalPaise: 3400, items: [{ productId: 1, qty: 1, changed: true }] });
  });

  it('includes one-off additions and skips inactive products', () => {
    const day = planDay(
      '2026-11-01',
      inputs({
        subscriptions: [
          { productId: 1, defaultQty: 1 },
          { productId: 3, defaultQty: 1 },
        ],
        overrides: new Map([['2026-11-01', new Map([[2, 1]])]]),
      }),
      products,
    );
    expect(day.items.map((i) => i.productId)).toEqual([1, 2]);
    expect(day.totalPaise).toBe(10000);
  });
});
