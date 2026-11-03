import { profileInput } from '@vivid-milks/shared';
import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../app';
import { currentUser } from '../auth';
import { parse } from '../errors';
import { listBuildings } from '../services/buildings';
import { getMe, updateProfile } from '../services/customer';
import { loadProducts } from '../services/data';
import { getPaymentQr } from '../services/payments';
import { getSettings } from '../services/settings';

/** Endpoints for any signed-in user. */
export async function commonRoutes(app: FastifyInstance, { db }: AppContext) {
  app.get('/me', async (req) => getMe(db, currentUser(req).id));
  app.put('/me/profile', async (req) => updateProfile(db, currentUser(req).id, parse(profileInput, req.body)));
  app.get('/products', async () => [...(await loadProducts(db)).values()].filter((p) => p.active));
  app.get('/settings', async () => getSettings(db));
  app.get('/buildings', async () => listBuildings(db));
  app.get('/payment-qr', async () => getPaymentQr(db));
}
