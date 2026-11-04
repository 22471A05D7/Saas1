import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { notFound } from '../../lib/errors';
import { ok } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { requireAuth, tenant } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

/**
 * Organization settings.
 *
 * The organization is always addressed by the id on the session, so a user can
 * only ever read or modify the settings of their own tenant. Changing
 * `defaultLowStockThreshold` immediately affects every product that has no
 * threshold of its own, because the default is resolved at query time rather
 * than copied onto products.
 */
const updateSettingsSchema = z
  .object({
    name: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(255).optional(),
    defaultLowStockThreshold: z.coerce
      .number({ invalid_type_error: 'Must be a whole number' })
      .int('Must be a whole number')
      .min(0, 'Threshold cannot be negative')
      .max(100_000_000, 'Threshold is too large')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one setting to update',
  });

const organizationSelect = {
  id: true,
  name: true,
  defaultLowStockThreshold: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = tenant(req);

    const [organization, userCount, productCount] = await prisma.$transaction([
      prisma.organization.findUnique({ where: { id: organizationId }, select: organizationSelect }),
      prisma.user.count({ where: { organizationId } }),
      prisma.product.count({ where: { organizationId } }),
    ]);

    if (!organization) throw notFound('Organization not found');

    return ok(res, { organization, stats: { userCount, productCount } });
  }),
);

settingsRouter.patch(
  '/',
  validate(updateSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = tenant(req);
    const input = req.body as z.infer<typeof updateSettingsSchema>;

    const data: { name?: string; defaultLowStockThreshold?: number } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.defaultLowStockThreshold !== undefined) {
      data.defaultLowStockThreshold = input.defaultLowStockThreshold;
    }

    const result = await prisma.organization.updateMany({ where: { id: organizationId }, data });
    if (result.count === 0) throw notFound('Organization not found');

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: organizationSelect,
    });

    return ok(res, { organization });
  }),
);
