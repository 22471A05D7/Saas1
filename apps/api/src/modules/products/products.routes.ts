import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as controller from './products.controller';
import {
  createProductSchema,
  listProductsSchema,
  productIdSchema,
  stockAdjustmentSchema,
  updateProductSchema,
} from './products.schemas';

export const productsRouter = Router();

// Every product route requires a session; there is no public product data.
productsRouter.use(requireAuth);

productsRouter.get('/', validate(listProductsSchema, 'query'), asyncHandler(controller.list));
productsRouter.post('/', validate(createProductSchema), asyncHandler(controller.create));

productsRouter.get(
  '/:id',
  validate(productIdSchema, 'params'),
  asyncHandler(controller.getById),
);

productsRouter.patch(
  '/:id',
  validate(productIdSchema, 'params'),
  validate(updateProductSchema),
  asyncHandler(controller.update),
);

productsRouter.delete(
  '/:id',
  validate(productIdSchema, 'params'),
  asyncHandler(controller.remove),
);

productsRouter.patch(
  '/:id/stock',
  validate(productIdSchema, 'params'),
  validate(stockAdjustmentSchema),
  asyncHandler(controller.adjustStock),
);
