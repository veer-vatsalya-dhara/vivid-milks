import type {
  AdminDashboard,
  Building,
  Me,
  OrderHistoryEntry,
  PaymentQr,
  PaymentRequest,
  Product,
  Schedule,
  Wallet,
} from '@vivid-milks/shared';
import ExcelJS from 'exceljs';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/client';
import { seedIfEmpty } from '../src/db/seed';

// Seeded users, in insert order. Asha (₹1000) and the admin (₹500) can pay; Rahul (₹50) can't cover ₹104.
const ADMIN = 1;
const ASHA = 3;
const RAHUL = 4;
const COW_500 = 1;
const RESIDENCY = 1;
const LAKE_VIEW = 2;

const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);

let database: Database;
let app: FastifyInstance;
let clock: Date;

beforeEach(async () => {
  database = await openDatabase({ pgliteDataDir: 'memory://' });
  await seedIfEmpty(database.db);
  clock = ist('2026-11-01', '10:00');
  app = await buildApp({ db: database.db, now: () => clock, devAuth: true });
});

afterEach(async () => {
  await app.close();
  await database.close();
});

async function call<T>(userId: number, method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: object) {
  const res = await app.inject({
    method,
    url,
    headers: { 'x-user-id': String(userId) },
    ...(body ? { payload: body } : {}),
  });
  return { status: res.statusCode, body: res.json() as T };
}

const tomorrowFor = async (userId: number) =>
  (await call<Schedule>(userId, 'GET', '/api/me/schedule?from=2026-11-02&to=2026-11-03')).body.days;

describe('6 PM cutoff', () => {
  it('stops changes to tomorrow from 6 PM', async () => {
    clock = ist('2026-11-01', '17:59');
    expect((await call(ASHA, 'PUT', `/api/me/schedule/2026-11-02/${COW_500}`, { qty: 3 })).status).toBe(200);
    clock = ist('2026-11-01', '18:00');
    expect((await call(ASHA, 'PUT', `/api/me/schedule/2026-11-02/${COW_500}`, { qty: 1 })).status).toBe(409);
  });

  it('applies subscription changes after 6 PM from the day after tomorrow', async () => {
    clock = ist('2026-11-01', '19:00');
    await call(ASHA, 'PUT', `/api/me/subscriptions/${COW_500}`, { defaultQty: 5 });
    const [tomorrow, dayAfter] = await tomorrowFor(ASHA);
    expect(tomorrow!.items).toEqual([{ productId: COW_500, qty: 2, changed: false }]);
    expect(tomorrow!.status).toBe('pending');
    expect(dayAfter!.items).toEqual([{ productId: COW_500, qty: 5, changed: false }]);
  });

  it('applies subscription changes before 6 PM from tomorrow', async () => {
    clock = ist('2026-11-01', '17:00');
    await call(ASHA, 'PUT', `/api/me/subscriptions/${COW_500}`, { defaultQty: 5 });
    const [tomorrow] = await tomorrowFor(ASHA);
    expect(tomorrow!.items[0]!.qty).toBe(5);
  });

  it('keeps tomorrow when a subscription is stopped after 6 PM', async () => {
    clock = ist('2026-11-01', '18:30');
    await call(ASHA, 'DELETE', `/api/me/subscriptions/${COW_500}`);
    const [tomorrow, dayAfter] = await tomorrowFor(ASHA);
    expect(tomorrow!.items[0]!.qty).toBe(2);
    expect(dayAfter!.items).toEqual([]);
  });
});

describe('buildings and addresses', () => {
  const profile = (address: object) => ({ name: 'Asha Sharma', phone: '9000000003', address });

  it('saves an address in a building block', async () => {
    const { status, body } = await call<Me>(
      ASHA,
      'PUT',
      '/api/me/profile',
      profile({ buildingId: RESIDENCY, block: 'b', floor: 5, line1: '502' }),
    );
    expect(status).toBe(200);
    expect(body.address).toMatchObject({ buildingName: 'Green Park Residency', block: 'B', floor: 5, line1: '502', area: '' });
  });

  it('requires a block from the building', async () => {
    const res = await call(ASHA, 'PUT', '/api/me/profile', profile({ buildingId: RESIDENCY, block: 'Z', floor: 1, line1: '1' }));
    expect(res.status).toBe(400);
    const ok = await call(ASHA, 'PUT', '/api/me/profile', profile({ buildingId: LAKE_VIEW, floor: 0, line1: 'G1' }));
    expect(ok.status).toBe(200);
  });

  it('lets admins manage buildings, but not delete ones people live in', async () => {
    const created = await call<Building[]>(ADMIN, 'POST', '/api/admin/buildings', {
      name: 'Vaswani Brentwood',
      blocks: ['A', 'B', 'C', 'D'],
    });
    const brentwood = created.body.find((b) => b.name === 'Vaswani Brentwood')!;
    expect(brentwood.blocks).toEqual(['A', 'B', 'C', 'D']);
    expect((await call(ADMIN, 'POST', '/api/admin/buildings', { name: 'vaswani brentwood' })).status).toBe(409);

    const updated = await call<Building[]>(ADMIN, 'PUT', `/api/admin/buildings/${brentwood.id}`, {
      name: 'Vaswani Brentwood',
      blocks: ['A', 'B', 'C'],
    });
    expect(updated.body.find((b) => b.id === brentwood.id)!.blocks).toEqual(['A', 'B', 'C']);
    expect((await call(ADMIN, 'DELETE', `/api/admin/buildings/${brentwood.id}`)).status).toBe(200);

    expect((await call(ADMIN, 'DELETE', `/api/admin/buildings/${RESIDENCY}`)).status).toBe(409);
    // Asha lives in block A.
    const dropA = await call(ADMIN, 'PUT', `/api/admin/buildings/${RESIDENCY}`, { name: 'Green Park Residency', blocks: ['B'] });
    expect(dropA.status).toBe(409);
    expect((await call(ASHA, 'POST', '/api/admin/buildings', { name: 'X' })).status).toBe(403);
    expect((await call<Building[]>(ASHA, 'GET', '/api/buildings')).body).toHaveLength(2);
  });
});

describe('payments', () => {
  it('credits the wallet once an admin approves', async () => {
    const created = await call<PaymentRequest[]>(ASHA, 'POST', '/api/me/payment-requests', {
      amountPaise: 50000,
      method: 'upi',
      reference: 'UTR123',
    });
    expect(created.status).toBe(200);
    const request = created.body[0]!;
    expect(request.status).toBe('pending');

    const dashboard = await call<AdminDashboard>(ADMIN, 'GET', '/api/admin/dashboard');
    expect(dashboard.body.pendingPayments.map((p) => p.id)).toEqual([request.id]);

    const before = (await call<Wallet>(ASHA, 'GET', '/api/me/wallet')).body.balancePaise;
    expect((await call(ADMIN, 'POST', `/api/admin/payment-requests/${request.id}/approve`)).status).toBe(200);
    const after = await call<Wallet>(ASHA, 'GET', '/api/me/wallet');
    expect(after.body.balancePaise).toBe(before + 50000);
    expect(after.body.transactions[0]).toMatchObject({ type: 'topup', note: 'UPI · UTR123' });

    // Approving twice must not credit twice.
    expect((await call(ADMIN, 'POST', `/api/admin/payment-requests/${request.id}/approve`)).status).toBe(409);
    expect((await call<Wallet>(ASHA, 'GET', '/api/me/wallet')).body.balancePaise).toBe(before + 50000);
  });

  it('leaves the wallet alone when rejected', async () => {
    const [request] = (
      await call<PaymentRequest[]>(ASHA, 'POST', '/api/me/payment-requests', { amountPaise: 20000, method: 'cash' })
    ).body;
    const before = (await call<Wallet>(ASHA, 'GET', '/api/me/wallet')).body.balancePaise;
    await call(ADMIN, 'POST', `/api/admin/payment-requests/${request!.id}/reject`);
    expect((await call<Wallet>(ASHA, 'GET', '/api/me/wallet')).body.balancePaise).toBe(before);
    const mine = await call<PaymentRequest[]>(ASHA, 'GET', '/api/me/payment-requests');
    expect(mine.body[0]!.status).toBe('rejected');
  });

  it('stores the payment QR image', async () => {
    const image = 'data:image/png;base64,iVBORw0KGgo=';
    expect((await call(ASHA, 'PUT', '/api/admin/payment-qr', { image })).status).toBe(403);
    expect((await call(ADMIN, 'PUT', '/api/admin/payment-qr', { image: 'not an image' })).status).toBe(400);
    await call(ADMIN, 'PUT', '/api/admin/payment-qr', { image });
    expect((await call<PaymentQr>(ASHA, 'GET', '/api/payment-qr')).body.image).toBe(image);
    await call(ADMIN, 'DELETE', '/api/admin/payment-qr');
    expect((await call<PaymentQr>(ASHA, 'GET', '/api/payment-qr')).body.image).toBeNull();
  });
});

describe('products', () => {
  it('deletes a product, its subscriptions, and keeps order history', async () => {
    await call(ADMIN, 'POST', '/api/admin/lock', { date: '2026-11-01' });
    clock = ist('2026-11-01', '11:00');
    const res = await call<Product[]>(ADMIN, 'DELETE', `/api/admin/products/${COW_500}`);
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.id)).not.toContain(COW_500);
    expect((await call<Product[]>(ASHA, 'GET', '/api/products')).body.map((p) => p.id)).not.toContain(COW_500);
    const [tomorrow] = await tomorrowFor(ASHA);
    expect(tomorrow!.items).toEqual([]);
    const history = await call<OrderHistoryEntry[]>(ASHA, 'GET', '/api/me/orders');
    expect(history.body[0]!.items[0]).toMatchObject({ name: 'Cow Milk', unitLabel: '500 ml', qty: 2 });
    expect((await call(ADMIN, 'PUT', `/api/admin/products/${COW_500}`, { name: 'x', unitLabel: 'y', pricePaise: 1, active: true })).status).toBe(404);
  });
});

describe('low balance', () => {
  it('leaves customers who can’t pay out of tomorrow’s totals', async () => {
    const { body } = await call<AdminDashboard>(ADMIN, 'GET', '/api/admin/dashboard');
    // Asha 2, the admin 1 and Priya 1 × Cow 500 ml; Rahul's ₹104 order is skipped.
    expect(body.tomorrow).toMatchObject({ customerCount: 3, skippedLowBalance: 1, totalPaise: 4 * 3400 });
    expect(body.tomorrow.totals).toEqual([{ productId: COW_500, name: 'Cow Milk', unitLabel: '500 ml', qty: 4 }]);
  });
});

describe('no routes needed', () => {
  it('delivers to a customer with an address but no route, and shows the drop to any delivery person', async () => {
    const sunil = (await call<{ id: number }>(ADMIN, 'POST', '/api/admin/users', { name: 'Sunil (Delivery)', role: 'delivery' }))
      .body.id;
    await call(ADMIN, 'POST', '/api/admin/lock', { date: '2026-11-01' });
    const run = await call<{ drops: { id: number; customerName: string }[] }>(sunil, 'GET', '/api/delivery/run');
    const priya = run.body.drops.find((d) => d.customerName === 'Priya Nair')!;
    expect(priya).toBeDefined();
    expect((await call(sunil, 'POST', `/api/delivery/drops/${priya.id}/mark`, { status: 'delivered' })).status).toBe(200);
  });
});

describe('order history', () => {
  it('lists the customer’s deliveries, newest first', async () => {
    await call(ADMIN, 'POST', '/api/admin/lock', { date: '2026-11-01' });
    await call(ADMIN, 'POST', '/api/admin/lock', { date: '2026-11-02' });
    const { body } = await call<OrderHistoryEntry[]>(ASHA, 'GET', '/api/me/orders');
    expect(body.map((o) => o.date)).toEqual(['2026-11-02', '2026-11-01']);
    expect(body[0]).toMatchObject({ status: 'pending', totalPaise: 6800 });
    expect((await call<OrderHistoryEntry[]>(RAHUL, 'GET', '/api/me/orders')).body[0]!.status).toBe('skipped_low_balance');
  });
});

describe('Excel export', () => {
  it('sorts by building (Z→A), block, then floor (top first)', async () => {
    await call(ADMIN, 'POST', '/api/admin/buildings', { name: 'Vaswani Brentwood', blocks: ['A', 'B'] });
    const buildings = (await call<Building[]>(ADMIN, 'GET', '/api/admin/buildings')).body;
    const brentwood = buildings.find((b) => b.name === 'Vaswani Brentwood')!.id;
    // Asha moves to Brentwood A, floor 2. The admin stays in Residency B, floor 4.
    await call(ASHA, 'PUT', '/api/me/profile', {
      name: 'Asha Sharma',
      phone: '9000000003',
      address: { buildingId: brentwood, block: 'A', floor: 2, line1: '201' },
    });
    await call(ADMIN, 'POST', `/api/admin/customers/${RAHUL}/wallet`, { amountPaise: 100000, note: 'Cash' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/orders/2026-11-02/export',
      headers: { 'x-user-id': String(ADMIN) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.rawPayload as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet('Deliveries')!;
    const rows: string[] = [];
    sheet.eachRow((row, n) => {
      if (n > 3) rows.push([row.getCell(2).text, row.getCell(3).text, row.getCell(4).text, row.getCell(6).text].join('|'));
    });
    expect(rows).toEqual([
      'Vaswani Brentwood|A|2|Asha Sharma',
      'Lake View Apartments||3|Priya Nair',
      'Green Park Residency|B|4|Admin',
      'Green Park Residency|B|Ground|Rahul Verma',
      'Total|||',
    ]);
  });
});
