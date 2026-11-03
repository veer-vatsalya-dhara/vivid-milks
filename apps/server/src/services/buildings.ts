import type { Address, Building } from '@vivid-milks/shared';
import type { buildingInput } from '@vivid-milks/shared';
import { asc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../db/client';
import { addresses, buildings } from '../db/schema';
import { badRequest, conflict, notFound } from '../errors';

export type AddressRow = typeof addresses.$inferSelect;

/** The shared `Address` shape from an address row and its building's name. */
export function toAddress(row: AddressRow, buildingName: string | null): Address {
  return {
    buildingId: row.buildingId,
    buildingName,
    block: row.block,
    floor: row.floor,
    line1: row.line1,
    line2: row.line2,
    area: row.area,
    landmark: row.landmark,
  };
}

export async function listBuildings(db: Db): Promise<Building[]> {
  return db
    .select({
      id: buildings.id,
      name: buildings.name,
      blocks: buildings.blocks,
      customerCount: sql<number>`(select count(*) from ${addresses} where ${addresses.buildingId} = ${buildings.id})::int`,
    })
    .from(buildings)
    .orderBy(asc(buildings.name));
}

async function assertNameFree(db: Db, name: string, exceptId?: number) {
  const [existing] = await db
    .select()
    .from(buildings)
    .where(sql`lower(${buildings.name}) = lower(${name})`);
  if (existing && existing.id !== exceptId) throw conflict(`${existing.name} is already in the list`);
}

export async function createBuilding(db: Db, input: z.output<typeof buildingInput>): Promise<Building[]> {
  await assertNameFree(db, input.name);
  await db.insert(buildings).values(input);
  return listBuildings(db);
}

export async function updateBuilding(db: Db, id: number, input: z.output<typeof buildingInput>): Promise<Building[]> {
  await assertNameFree(db, input.name, id);
  const [current] = await db.select().from(buildings).where(eq(buildings.id, id));
  if (!current) throw notFound('Building');

  // Don't drop a block someone lives in; their address would stop making sense.
  const removed = current.blocks.filter((b) => !input.blocks.includes(b));
  if (removed.length) {
    const inUse = await db
      .select({ block: addresses.block, count: sql<number>`count(*)::int` })
      .from(addresses)
      .where(eq(addresses.buildingId, id))
      .groupBy(addresses.block);
    const blocked = inUse.filter((r) => removed.includes(r.block));
    if (blocked.length) {
      const list = blocked.map((r) => `${r.block} (${r.count})`).join(', ');
      throw conflict(`Customers still live in block ${list}. Ask them to update their address first.`);
    }
  }
  await db.update(buildings).set(input).where(eq(buildings.id, id));
  return listBuildings(db);
}

export async function deleteBuilding(db: Db, id: number): Promise<Building[]> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(addresses)
    .where(eq(addresses.buildingId, id));
  if (count > 0) {
    throw conflict(`${count} customer${count === 1 ? '' : 's'} live here. Ask them to pick another building first.`);
  }
  const deleted = await db.delete(buildings).where(eq(buildings.id, id)).returning();
  if (deleted.length === 0) throw notFound('Building');
  return listBuildings(db);
}

/** Checks the building exists and the block is one of its blocks. Returns the block as stored. */
export async function validateAddressBuilding(db: Db, buildingId: number, block: string): Promise<string> {
  const [building] = await db.select().from(buildings).where(eq(buildings.id, buildingId));
  if (!building) throw badRequest('Choose your building or society');
  if (building.blocks.length === 0) return '';
  const match = building.blocks.find((b) => b.toLowerCase() === block.toLowerCase());
  if (!match) throw badRequest(`Choose your block in ${building.name}`);
  return match;
}

