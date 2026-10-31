import { todayInIst, type Wallet, type WalletCreditInput } from '@vivid-milks/shared';
import { desc, eq } from 'drizzle-orm';

import type { Db } from '../db/client';
import { deliveries, users, walletTxns } from '../db/schema';
import { notFound } from '../errors';
import { loadWalletSummaries } from './data';

const RECENT_TXNS = 100;

export async function getWallet(db: Db, customerId: number, now: Date): Promise<Wallet> {
  const [summaries, rows] = await Promise.all([
    loadWalletSummaries(db, [customerId], todayInIst(now)),
    db
      .select({ txn: walletTxns, deliveryDate: deliveries.date })
      .from(walletTxns)
      .leftJoin(deliveries, eq(deliveries.id, walletTxns.deliveryId))
      .where(eq(walletTxns.customerId, customerId))
      .orderBy(desc(walletTxns.createdAt), desc(walletTxns.id))
      .limit(RECENT_TXNS),
  ]);
  return {
    ...summaries.get(customerId)!,
    transactions: rows.map(({ txn, deliveryDate }) => ({
      id: txn.id,
      amountPaise: txn.amountPaise,
      type: txn.type,
      note: txn.note,
      deliveryDate,
      createdAt: txn.createdAt.toISOString(),
    })),
  };
}

/** Admin credit (positive) or correction (negative). */
export async function addWalletTxn(
  db: Db,
  adminId: number,
  customerId: number,
  input: WalletCreditInput,
  now: Date,
): Promise<Wallet> {
  const [customer] = await db.select({ id: users.id }).from(users).where(eq(users.id, customerId));
  if (!customer) throw notFound('Customer');
  await db.insert(walletTxns).values({
    customerId,
    amountPaise: input.amountPaise,
    type: input.amountPaise > 0 ? 'topup' : 'adjustment',
    note: input.note,
    createdBy: adminId,
  });
  return getWallet(db, customerId, now);
}
