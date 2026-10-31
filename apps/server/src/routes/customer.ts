import {
  addDays,
  dayQtyInput,
  isIsoDate,
  pauseInput,
  subscriptionInput,
  todayInIst,
} from '@vivid-milks/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUser, requireRole } from '../auth';
import { parse } from '../errors';
import type { AppContext } from '../app';
import {
  createPause,
  endPause,
  getActivePause,
  getCustomerHome,
  getSchedule,
  getSubscriptions,
  removeSubscription,
  setDayQty,
  setSubscription,
} from '../services/customer';
import { getWallet } from '../services/wallet';

const productParams = z.object({ productId: z.coerce.number().int() });
const dayParams = z.object({
  date: z.string().refine(isIsoDate, 'Expected YYYY-MM-DD'),
  productId: z.coerce.number().int(),
});
const scheduleQuery = z.object({
  from: z.string().refine(isIsoDate).optional(),
  to: z.string().refine(isIsoDate).optional(),
});

/** The signed-in user's own orders. Customers and admins. */
export async function customerRoutes(app: FastifyInstance, { db, now }: AppContext) {
  app.addHook('preHandler', requireRole('customer', 'admin'));
  const me = (req: Parameters<typeof currentUser>[0]) => currentUser(req).id;

  app.get('/home', async (req) => getCustomerHome(db, me(req), now()));

  app.get('/subscriptions', async (req) => getSubscriptions(db, me(req)));
  app.put('/subscriptions/:productId', async (req) => {
    const { productId } = parse(productParams, req.params);
    return setSubscription(db, me(req), productId, parse(subscriptionInput, req.body).defaultQty);
  });
  app.delete('/subscriptions/:productId', async (req) => {
    const { productId } = parse(productParams, req.params);
    return removeSubscription(db, me(req), productId);
  });

  app.get('/schedule', async (req) => {
    const today = todayInIst(now());
    const { from = today, to = addDays(from, 29) } = parse(scheduleQuery, req.query);
    return { days: await getSchedule(db, me(req), from, to, now()) };
  });
  app.put('/schedule/:date/:productId', async (req) => {
    const { date, productId } = parse(dayParams, req.params);
    return setDayQty(db, me(req), date, productId, parse(dayQtyInput, req.body).qty, now());
  });

  app.get('/pause', async (req) => ({ pause: await getActivePause(db, me(req), now()) }));
  app.post('/pause', async (req) => ({ pause: await createPause(db, me(req), parse(pauseInput, req.body), now()) }));
  app.delete('/pause', async (req) => ({ pause: await endPause(db, me(req), now()) }));

  app.get('/wallet', async (req) => getWallet(db, me(req), now()));
}
