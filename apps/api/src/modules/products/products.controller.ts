import type { Request, Response } from 'express';
import { created, ok } from '../../lib/http';
import { tenant } from '../../middleware/auth';
import * as productsService from './products.service';
import type {
  CreateProductInput,
  ListProductsQuery,
  StockAdjustmentInput,
  UpdateProductInput,
} from './products.schemas';

/**
 * Every handler derives `organizationId` from `tenant(req)` — the verified
 * session — and passes it to the service as the tenant scope.
 */

export async function list(req: Request, res: Response) {
  const { organizationId } = tenant(req);
  const result = await productsService.listProducts(
    organizationId,
    req.query as unknown as ListProductsQuery,
  );
  return ok(res, { products: result.products }, { pagination: result.pagination });
}

export async function getById(req: Request, res: Response) {
  const { organizationId } = tenant(req);
  const product = await productsService.getProduct(organizationId, req.params.id);
  return ok(res, { product });
}

export async function create(req: Request, res: Response) {
  const { organizationId } = tenant(req);
  const product = await productsService.createProduct(organizationId, req.body as CreateProductInput);
  return created(res, { product });
}

export async function update(req: Request, res: Response) {
  const { organizationId } = tenant(req);
  const product = await productsService.updateProduct(
    organizationId,
    req.params.id,
    req.body as UpdateProductInput,
  );
  return ok(res, { product });
}

export async function remove(req: Request, res: Response) {
  const { organizationId } = tenant(req);
  await productsService.deleteProduct(organizationId, req.params.id);
  return ok(res, { message: 'Product deleted' });
}

export async function adjustStock(req: Request, res: Response) {
  const { organizationId } = tenant(req);
  const product = await productsService.adjustStock(
    organizationId,
    req.params.id,
    req.body as StockAdjustmentInput,
  );
  return ok(res, { product });
}
