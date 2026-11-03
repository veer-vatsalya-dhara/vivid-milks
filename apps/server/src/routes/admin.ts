import {
  assignRouteInput,
  buildingInput,
  isIsoDate,
  lockInput,
  paymentQrInput,
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
  deleteProduct,
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
import { createBuilding, deleteBuilding, listBuildings, updateBuilding } from '../services/buildings';
import { removeSubscription, setSubscription } from '../services/customer';
import { buildOrdersWorkbook } from '../services/export';
import { lockDate } from '../services/locking';
import { decidePaymentRequest, listPaymentRequests, setPaymentQr } from '../services/payments';
import { updateSettings } from '../services/settings';
import { addWalletTxn } from '../services/wallet';

const idParams = z.object({ id: z.coerce.number().int() });
const subParams = z.object({ id: z.coerce.number().int(), productId: z.coerce.number().int() });
const searchQuery = z.object({ q: z.string().default('') });
const dateParams = z.object({ date: z.string().refine(isIsoDate, 'Expected YYYY-MM-DD') });
const paymentFilter = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() });
/** Room for a base64 QR image plus JSON overhead. */
const QR_BODY_LIMIT = 2 * 1024 * 1024;

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
    return setSubscription(db, id, productId, parse(subscriptionInput, req.body).defaultQty, now());
  });
  app.delete('/customers/:id/subscriptions/:productId', async (req) => {
    const { id, productId } = parse(subParams, req.params);
    return removeSubscription(db, id, productId, now());
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
  app.delete('/products/:id', async (req) => deleteProduct(db, parse(idParams, req.params).id, now()));

  app.get('/buildings', async () => listBuildings(db));
  app.post('/buildings', async (req) => createBuilding(db, parse(buildingInput, req.body)));
  app.put('/buildings/:id', async (req) =>
    updateBuilding(db, parse(idParams, req.params).id, parse(buildingInput, req.body)),
  );
  app.delete('/buildings/:id', async (req) => deleteBuilding(db, parse(idParams, req.params).id));

  app.get('/payment-requests', async (req) => listPaymentRequests(db, parse(paymentFilter, req.query)));
  app.post('/payment-requests/:id/approve', async (req) =>
    decidePaymentRequest(db, currentUser(req).id, parse(idParams, req.params).id, 'approved', now()),
  );
  app.post('/payment-requests/:id/reject', async (req) =>
    decidePaymentRequest(db, currentUser(req).id, parse(idParams, req.params).id, 'rejected', now()),
  );
  app.put('/payment-qr', { bodyLimit: QR_BODY_LIMIT }, async (req) =>
    setPaymentQr(db, parse(paymentQrInput, req.body).image),
  );
  app.delete('/payment-qr', async () => setPaymentQr(db, null));

  /** The day's delivery list as an Excel file, sorted for walking each building top-down. */
  app.get('/orders/:date/export', async (req, reply) => {
    const { date } = parse(dateParams, req.params);
    const buffer = await buildOrdersWorkbook(db, date, now());
    return reply
      .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('content-disposition', `attachment; filename="vivid-milks-orders-${date}.xlsx"`)
      .send(buffer);
  });

  app.put('/settings', async (req) => updateSettings(db, parse(settingsInput, req.body)));

  /** Locks a date's orders now instead of waiting for the cutoff job. */
  app.post('/lock', async (req) => lockDate(db, parse(lockInput, req.body).date, now()));
}
