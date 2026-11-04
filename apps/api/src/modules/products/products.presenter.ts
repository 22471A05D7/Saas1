import type { Product } from '@prisma/client';
import { effectiveThreshold, stockStatus, type StockStatus } from '../../lib/stock';

export interface ProductDto {
  id: string;
  organizationId: string;
  name: string;
  sku: string;
  description: string | null;
  quantityOnHand: number;
  /** Money is serialised as a fixed-2 decimal string so no precision is lost. */
  costPrice: string;
  sellingPrice: string;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  stockStatus: StockStatus;
  lastStockNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Converts a Prisma `Product` into the API representation, resolving the
 * effective threshold and stock status against the organization's default.
 */
export function presentProduct(product: Product, organizationDefaultThreshold: number): ProductDto {
  return {
    id: product.id,
    organizationId: product.organizationId,
    name: product.name,
    sku: product.sku,
    description: product.description,
    quantityOnHand: product.quantityOnHand,
    costPrice: product.costPrice.toFixed(2),
    sellingPrice: product.sellingPrice.toFixed(2),
    lowStockThreshold: product.lowStockThreshold,
    effectiveLowStockThreshold: effectiveThreshold(
      product.lowStockThreshold,
      organizationDefaultThreshold,
    ),
    stockStatus: stockStatus(
      product.quantityOnHand,
      product.lowStockThreshold,
      organizationDefaultThreshold,
    ),
    lastStockNote: product.lastStockNote,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
