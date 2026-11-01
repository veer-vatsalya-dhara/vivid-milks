import {
  assignRouteInput,
  lockInput,
  productInput,
  roleInput,
  routeInput,
  settingsInput,
  subscriptionInput,
  userInput,
  walletCreditInput,
} from '@vivid-milks/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AppContext } from '../app';
import { currentUser, requireRole } from '../auth';
import { parse } from '../errors';
import {
  assignRoute,
  createProduct,
  createRoute,
  createUser,
  getCustomerDetail,
  getDashboard,
  listAllProducts,
  listCustomers,
  listRoutes,
  listUsers,
  removeUser,
  setRole,
  updateProduct,
  updateRoute,
  updateUser,
} from '../services/admin';
import { removeSubscription, setSubscription } from '../services/customer';
import { lockDate } from '../services/locking';
import { updateSettings } from '../services/settings';
import { addWalletTxn } from '../services/wallet';

const idParams = z.object({ id: z.coerce.number().int() });
const subParams = z.object({ id: z.coerce.number().int(), productId: z.coerce.number().int() });
const searchQuery = z.object({ q: z.string().default('') });

export async function adminRoutes(app: FastifyInstance, { db, now }: AppContext) {
  app.addHook('preHandler', requireRole('admin'));

  app.get('/dashboard', async () => getDashboard(db, now()));

  app.get('/customers', async (req) => listCustomers(db, parse(searchQuery, req.query).q, now()));
  app.get('/customers/:id', async (req) => getCustomerDetail(db, parse(idParams, req.params).id, now()));
  app.put('/customers/:id/route', async (req) =>
    assignRoute(db, parse(idParams, req.params).id, parse(assignRouteInput, req.body), now()),
  );
  app.post('/customers/:id/wallet', async (req) =>
    addWalletTxn(db, currentUser(req).id, parse(idParams, req.params).id, parse(walletCreditInput, req.body), now()),
  );
  app.put('/customers/:id/subscriptions/:productId', async (req) => {
    const { id, productId } = parse(subParams, req.params);
    return setSubscription(db, id, productId, parse(subscriptionInput, req.body).defaultQty);
  });
  app.delete('/customers/:id/subscriptions/:productId', async (req) => {
    const { id, productId } = parse(subParams, req.params);
    return removeSubscription(db, id, productId);
  });

  app.get('/users', async () => listUsers(db));
  app.post('/users', async (req) => createUser(db, parse(userInput, req.body)));
  app.put('/users/:id', async (req) =>
    updateUser(db, currentUser(req).id, parse(idParams, req.params).id, parse(userInput, req.body)),
  );
  app.delete('/users/:id', async (req) => {
    await removeUser(db, currentUser(req).id, parse(idParams, req.params).id, now());
    return { ok: true };
  });
  app.put('/users/:id/role', async (req) =>
    setRole(db, currentUser(req).id, parse(idParams, req.params).id, parse(roleInput, req.body).role),
  );

  app.get('/routes', async () => listRoutes(db));
  app.post('/routes', async (req) => createRoute(db, parse(routeInput, req.body)));
  app.put('/routes/:id', async (req) => updateRoute(db, parse(idParams, req.params).id, parse(routeInput, req.body)));

  app.get('/products', async () => listAllProducts(db));
  app.post('/products', async (req) => createProduct(db, parse(productInput, req.body)));
  app.put('/products/:id', async (req) =>
    updateProduct(db, parse(idParams, req.params).id, parse(productInput, req.body)),
  );

  app.put('/settings', async (req) => updateSettings(db, parse(settingsInput, req.body)));

  /** Locks a date's orders now instead of waiting for the cutoff job. */
  app.post('/lock', async (req) => lockDate(db, parse(lockInput, req.body).date, now()));
}
