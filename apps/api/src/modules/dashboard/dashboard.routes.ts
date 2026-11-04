import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { ok } from '../../lib/http';
import { requireAuth, tenant } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as dashboardService from './dashboard.service';

const lowStockQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = tenant(req);
    const summary = await dashboardService.getSummary(organizationId);
    return ok(res, { summary });
  }),
);

dashboardRouter.get(
  '/low-stock',
  validate(lowStockQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = tenant(req);
    const { limit } = req.query as unknown as z.infer<typeof lowStockQuerySchema>;
    const result = await dashboardService.getLowStock(organizationId, limit);
    return ok(res, result);
  }),
);
