import type { User } from '@vivid-milks/shared';
import { eq } from 'drizzle-orm';

import { toUser } from '../auth';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { forbidden } from '../errors';
import type { GoogleIdentity } from '../google';

/**
 * Finds or creates the person for a Google account. Matches by Google account id, then
 * by email (people added by an admin). New people become customers, unless their email
 * is in `adminEmails`, which also promotes existing people to admin.
 */
export async function signInWithGoogle(db: Db, identity: GoogleIdentity, adminEmails: string[]): Promise<User> {
  if (!identity.emailVerified) throw forbidden('Your Google email address is not verified');
  const isAdminEmail = adminEmails.includes(identity.email);

  const [bySub] = await db.select().from(users).where(eq(users.googleSub, identity.sub));
  const [byEmail] = bySub ? [] : await db.select().from(users).where(eq(users.email, identity.email));
  const existing = bySub ?? byEmail;

  if (existing) {
    if (existing.removedAt) throw forbidden('This account has been removed. Please contact Vivid Milks.');
    const [updated] = await db
      .update(users)
      .set({ googleSub: identity.sub, ...(isAdminEmail && { role: 'admin' as const }) })
      .where(eq(users.id, existing.id))
      .returning();
    return toUser(updated!);
  }

  const [created] = await db
    .insert(users)
    .values({
      name: identity.name,
      email: identity.email,
      googleSub: identity.sub,
      role: isAdminEmail ? 'admin' : 'customer',
    })
    .returning();
  return toUser(created!);
}
