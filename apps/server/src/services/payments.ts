import type { PaymentQr, PaymentRequest, PaymentRequestStatus, paymentRequestInput } from '@vivid-milks/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../db/client';
import { paymentRequests, settings, users, walletTxns } from '../db/schema';
import { conflict, notFound } from '../errors';

/** Stored in `settings`, but kept out of `getSettings` since it is large. */
const QR_KEY = 'paymentQrImage';
const MAX_PENDING_PER_CUSTOMER = 5;
const RECENT_REQUESTS = 50;

export async function getPaymentQr(db: Db): Promise<PaymentQr> {
  const [row] = await db.select().from(settings).where(eq(settings.key, QR_KEY));
  return { image: row?.value ?? null };
}

export async function setPaymentQr(db: Db, image: string | null): Promise<PaymentQr> {
  if (image === null) {
    await db.delete(settings).where(eq(settings.key, QR_KEY));
  } else {
    await db
      .insert(settings)
      .values({ key: QR_KEY, value: image })
      .onConflictDoUpdate({ target: settings.key, set: { value: image } });
  }
  return getPaymentQr(db);
}

/** Payment requests, newest first: one customer's, or everyone's with a given status. */
export async function listPaymentRequests(
  db: Db,
  filter: { customerId?: number; status?: PaymentRequestStatus },
): Promise<PaymentRequest[]> {
  const rows = await db
    .select({ request: paymentRequests, name: users.name, phone: users.phone })
    .from(paymentRequests)
    .innerJoin(users, eq(users.id, paymentRequests.customerId))
    .where(
      and(
        filter.customerId === undefined ? undefined : eq(paymentRequests.customerId, filter.customerId),
        filter.status === undefined ? undefined : eq(paymentRequests.status, filter.status),
      ),
    )
    .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id))
    .limit(RECENT_REQUESTS);
  return rows.map(({ request: r, name, phone }) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: name,
    customerPhone: phone,
    amountPaise: r.amountPaise,
    method: r.method,
    reference: r.reference,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
  }));
}

/** The customer's "I have paid". */
export async function createPaymentRequest(
  db: Db,
  customerId: number,
  input: z.output<typeof paymentRequestInput>,
): Promise<PaymentRequest[]> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentRequests)
    .where(and(eq(paymentRequests.customerId, customerId), eq(paymentRequests.status, 'pending')));
  if (count >= MAX_PENDING_PER_CUSTOMER) {
    throw conflict('You already have several payments waiting for approval. Please wait for the team to check them.');
  }
  await db.insert(paymentRequests).values({ customerId, ...input });
  return listPaymentRequests(db, { customerId });
}

/** Approving adds the amount to the customer's wallet; rejecting just closes the request. Each request is decided once. */
export async function decidePaymentRequest(
  db: Db,
  adminId: number,
  requestId: number,
  decision: 'approved' | 'rejected',
  now: Date,
): Promise<PaymentRequest[]> {
  await db.transaction(async (tx) => {
    // Only a pending request can be decided, so two admins tapping at once can't credit it twice.
    const [request] = await tx
      .update(paymentRequests)
      .set({ status: decision, decidedBy: adminId, decidedAt: now })
      .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, 'pending')))
      .returning();
    if (!request) {
      const [existing] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, requestId));
      if (!existing) throw notFound('Payment request');
      throw conflict(`This payment was already ${existing.status}`);
    }
    if (decision === 'approved') {
      const note = [request.method === 'upi' ? 'UPI' : 'Cash', request.reference].filter(Boolean).join(' · ');
      const [txn] = await tx
        .insert(walletTxns)
        .values({ customerId: request.customerId, amountPaise: request.amountPaise, type: 'topup', note, createdBy: adminId })
        .returning({ id: walletTxns.id });
      await tx.update(paymentRequests).set({ walletTxnId: txn!.id }).where(eq(paymentRequests.id, requestId));
    }
  });
  return listPaymentRequests(db, { status: 'pending' });
}
