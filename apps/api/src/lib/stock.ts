/**
 * Stock status rules — the single source of truth, shared by the product
 * endpoints and the dashboard so both always agree.
 *
 *   effective threshold = product.lowStockThreshold ?? organization.defaultLowStockThreshold
 *
 *   OUT_OF_STOCK  quantityOnHand === 0
 *   LOW_STOCK     quantityOnHand <= effective threshold  (and > 0)
 *   IN_STOCK      otherwise
 *
 * Out-of-stock is checked first, so a product with zero quantity is never
 * reported merely as "low".
 */
export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export function effectiveThreshold(
  productThreshold: number | null | undefined,
  organizationDefault: number,
): number {
  return productThreshold ?? organizationDefault;
}

export function stockStatus(
  quantityOnHand: number,
  productThreshold: number | null | undefined,
  organizationDefault: number,
): StockStatus {
  if (quantityOnHand <= 0) return 'OUT_OF_STOCK';
  if (quantityOnHand <= effectiveThreshold(productThreshold, organizationDefault)) {
    return 'LOW_STOCK';
  }
  return 'IN_STOCK';
}
