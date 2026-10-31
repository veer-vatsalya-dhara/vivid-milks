import { isIsoDate, markDeliveryInput, todayInIst } from '@vivid-milks/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AppContext } from '../app';
import { currentUser, requireRole } from '../auth';
import { parse } from '../errors';
import { getDeliveryRun, markDelivery } from '../services/deliveries';

const runQuery = z.object({
  date: z.string().refine(isIsoDate, 'Expected YYYY-MM-DD').optional(),
  routeId: z.coerce.number().int().optional(),
});
const dropParams = z.object({ id: z.coerce.number().int() });

export async function deliveryRoutes(app: FastifyInstance, { db, now }: AppContext) {
  app.addHook('preHandler', requireRole('delivery', 'admin'));

  app.get('/run', async (req) => {
    const { date = todayInIst(now()), routeId } = parse(runQuery, req.query);
    return getDeliveryRun(db, currentUser(req), date, routeId ?? null);
  });

  app.post('/drops/:id/mark', async (req) => {
    const { id } = parse(dropParams, req.params);
    return markDelivery(db, currentUser(req), id, parse(markDeliveryInput, req.body), now());
  });
}
