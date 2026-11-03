import { formatTimeOfDay, type IsoDate } from '@vivid-milks/shared';
import ExcelJS from 'exceljs';
import { inArray } from 'drizzle-orm';

import type { Db } from '../db/client';
import { addresses, buildings, routes, users } from '../db/schema';
import { getDayOrders, type DayOrder } from './day-orders';
import { getSettings } from './settings';

interface ExportRow {
  order: DayOrder;
  building: string;
  hasBuilding: boolean;
  block: string;
  floor: number | null;
  flat: string;
  name: string;
  phone: string;
  landmark: string;
  route: string;
}

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * Delivery order: buildings Z→A, then blocks A→Z, then floors top-down, then flats in
 * number order. Addresses without a building go last.
 */
export function compareForDelivery(a: ExportRow, b: ExportRow): number {
  if (a.hasBuilding !== b.hasBuilding) return a.hasBuilding ? -1 : 1;
  return (
    natural.compare(b.building, a.building) ||
    natural.compare(a.block, b.block) ||
    (b.floor ?? -1) - (a.floor ?? -1) ||
    natural.compare(a.flat, b.flat) ||
    natural.compare(a.name, b.name)
  );
}

/** Excel workbook of the day's orders: the delivery list, product totals, and who was skipped for low balance. */
export async function buildOrdersWorkbook(db: Db, date: IsoDate, now: Date): Promise<Buffer> {
  const [{ orders, products, locked }, settings] = await Promise.all([getDayOrders(db, date, now), getSettings(db)]);
  const customerIds = orders.map((o) => o.customerId);
  const [people, addressRows, buildingRows, routeRows] = customerIds.length
    ? await Promise.all([
        db.select().from(users).where(inArray(users.id, customerIds)),
        db.select().from(addresses).where(inArray(addresses.userId, customerIds)),
        db.select().from(buildings),
        db.select().from(routes),
      ])
    : [[], [], [], []];
  const personById = new Map(people.map((p) => [p.id, p]));
  const addressById = new Map(addressRows.map((a) => [a.userId, a]));
  const buildingById = new Map(buildingRows.map((b) => [b.id, b.name]));
  const routeById = new Map(routeRows.map((r) => [r.id, r.name]));

  const rows: ExportRow[] = orders.map((order) => {
    const address = addressById.get(order.customerId);
    const person = personById.get(order.customerId);
    const buildingName = address?.buildingId ? buildingById.get(address.buildingId) : undefined;
    return {
      order,
      building: buildingName ?? address?.line2 ?? '',
      hasBuilding: Boolean(buildingName),
      block: address?.block ?? '',
      floor: address?.floor ?? null,
      flat: address?.line1 ?? '',
      name: person?.name ?? '',
      phone: person?.phone ?? '',
      landmark: [address?.area, address?.landmark].filter(Boolean).join(', '),
      route: order.routeId ? (routeById.get(order.routeId) ?? '') : '',
    };
  });
  rows.sort(compareForDelivery);
  const delivering = rows.filter((r) => r.order.status !== 'skipped_low_balance');
  const skipped = rows.filter((r) => r.order.status === 'skipped_low_balance');

  // One column per product that appears in the day's deliveries, in catalogue order.
  const productIds = [...new Set(delivering.flatMap((r) => r.order.items.map((i) => i.productId)))].sort((a, b) => a - b);
  const productLabel = (id: number) => {
    const p = products.get(id);
    return p ? `${p.name} ${p.unitLabel}` : `Product ${id}`;
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Vivid Milks';
  workbook.created = now;
  const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const status = locked ? 'Final list (orders locked)' : `Draft: orders can still change until ${formatTimeOfDay(settings.orderCutoffTime)} the evening before`;

  // Deliveries
  const sheet = workbook.addWorksheet('Deliveries', { views: [{ state: 'frozen', ySplit: 3 }] });
  sheet.addRow([`Deliveries for ${dateLabel}`]).font = { bold: true, size: 14 };
  sheet.addRow([`${status} · ${delivering.length} deliveries`]).font = { italic: true, color: { argb: 'FF6B7280' } };
  const header = [
    '#',
    'Apartment / Society',
    'Block',
    'Floor',
    'Flat',
    'Customer',
    'Phone',
    ...productIds.map(productLabel),
    'Amount (₹)',
    'Landmark',
    'Route',
    'Delivered ✓',
  ];
  const headerRow = sheet.addRow(header);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E88E5' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  delivering.forEach((r, index) => {
    const qtyById = new Map(r.order.items.map((i) => [i.productId, i.qty]));
    sheet.addRow([
      index + 1,
      r.building,
      r.block,
      r.floor === null ? '' : r.floor === 0 ? 'Ground' : r.floor,
      r.flat,
      r.name,
      r.phone,
      ...productIds.map((id) => qtyById.get(id) ?? ''),
      r.order.totalPaise / 100,
      r.landmark,
      r.route,
      '',
    ]);
  });
  const totalsRow = sheet.addRow([
    '',
    'Total',
    '',
    '',
    '',
    '',
    '',
    ...productIds.map((id) =>
      delivering.reduce((sum, r) => sum + (r.order.items.find((i) => i.productId === id)?.qty ?? 0), 0),
    ),
    delivering.reduce((sum, r) => sum + r.order.totalPaise, 0) / 100,
  ]);
  totalsRow.font = { bold: true };
  sheet.columns.forEach((column, i) => {
    const widths = [5, 26, 8, 8, 10, 22, 14, ...productIds.map(() => 12), 12, 24, 14, 12];
    column.width = widths[i] ?? 12;
  });
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: header.length } };

  // Milk totals: what to load on the van
  const totals = workbook.addWorksheet('Milk totals');
  totals.addRow([`Milk to load for ${dateLabel}`]).font = { bold: true, size: 14 };
  totals.addRow(['Product', 'Packs']).font = { bold: true };
  for (const id of productIds) {
    totals.addRow([
      productLabel(id),
      delivering.reduce((sum, r) => sum + (r.order.items.find((i) => i.productId === id)?.qty ?? 0), 0),
    ]);
  }
  totals.getColumn(1).width = 28;
  totals.getColumn(2).width = 10;

  // Skipped for low balance: people to call
  if (skipped.length) {
    const low = workbook.addWorksheet('Skipped - low balance');
    low.addRow(['These customers will not get milk because their wallet balance is too low.']).font = { bold: true };
    low.addRow(['Customer', 'Phone', 'Apartment / Society', 'Block', 'Floor', 'Flat', 'Order amount (₹)']).font = {
      bold: true,
    };
    for (const r of skipped) {
      low.addRow([r.name, r.phone, r.building, r.block, r.floor ?? '', r.flat, r.order.totalPaise / 100]);
    }
    [22, 14, 26, 8, 8, 10, 16].forEach((w, i) => (low.getColumn(i + 1).width = w));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
