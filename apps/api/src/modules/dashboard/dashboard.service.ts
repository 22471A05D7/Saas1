import { Prisma } from '@prisma/client';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { stockStatus, type StockStatus } from '../../lib/stock';

/**
 * Dashboard aggregates.
 *
 * The figures are computed by PostgreSQL in a single organization-scoped query
 * rather than by loading rows into Node and reducing them, so the numbers stay
 * correct and cheap as a catalog grows. The effective threshold is resolved in
 * SQL with COALESCE(low_stock_threshold, <organization default>).
 *
 * Card semantics — deliberately mutually exclusive so the tiles never
 * double-count a product:
 *   Low Stock      quantity_on_hand > 0 AND quantity_on_hand <= effective threshold
 *   Out of Stock   quantity_on_hand = 0
 *
 * The low-stock *table* is broader: it lists everything at or below the
 * threshold (including zero-quantity products) and distinguishes them via the
 * Stock Status column, since both groups need restocking attention.
 */

export interface DashboardSummary {
  totalProducts: number;
  totalStockUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  inventoryCostValue: string;
  inventoryRetailValue: string;
  organization: {
    id: string;
    name: string;
    defaultLowStockThreshold: number;
  };
}

interface SummaryRow {
  totalProducts: number;
  totalStockUnits: string;
  lowStockProducts: number;
  outOfStockProducts: number;
  inventoryCostValue: string;
  inventoryRetailValue: string;
}

async function requireOrganization(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, defaultLowStockThreshold: true },
  });

  if (!org) throw notFound('Organization not found');
  return org;
}

export async function getSummary(organizationId: string): Promise<DashboardSummary> {
  const organization = await requireOrganization(organizationId);
  const threshold = organization.defaultLowStockThreshold;

  // Sums are cast to text so PostgreSQL bigint/numeric values survive the trip
  // without being coerced into a lossy JS number or an unserialisable BigInt.
  const rows = await prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::int AS "totalProducts",
      COALESCE(SUM(quantity_on_hand), 0)::text AS "totalStockUnits",
      COUNT(*) FILTER (
        WHERE quantity_on_hand > 0
          AND quantity_on_hand <= COALESCE(low_stock_threshold, ${threshold}::int)
      )::int AS "lowStockProducts",
      COUNT(*) FILTER (WHERE quantity_on_hand <= 0)::int AS "outOfStockProducts",
      COALESCE(SUM(quantity_on_hand * cost_price), 0)::text AS "inventoryCostValue",
      COALESCE(SUM(quantity_on_hand * selling_price), 0)::text AS "inventoryRetailValue"
    FROM products
    WHERE organization_id = ${organizationId}::uuid
  `);

  const row = rows[0];

  return {
    totalProducts: Number(row?.totalProducts ?? 0),
    totalStockUnits: Number(row?.totalStockUnits ?? 0),
    lowStockProducts: Number(row?.lowStockProducts ?? 0),
    outOfStockProducts: Number(row?.outOfStockProducts ?? 0),
    inventoryCostValue: toMoney(row?.inventoryCostValue),
    inventoryRetailValue: toMoney(row?.inventoryRetailValue),
    organization,
  };
}

export interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  quantityOnHand: number;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  stockStatus: StockStatus;
}

interface LowStockRow {
  id: string;
  name: string;
  sku: string;
  quantityOnHand: number;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
}

export async function getLowStock(
  organizationId: string,
  limit = 50,
): Promise<{ items: LowStockItem[]; organizationDefaultThreshold: number }> {
  const organization = await requireOrganization(organizationId);
  const threshold = organization.defaultLowStockThreshold;
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);

  const rows = await prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
    SELECT
      id,
      name,
      sku,
      quantity_on_hand AS "quantityOnHand",
      low_stock_threshold AS "lowStockThreshold",
      COALESCE(low_stock_threshold, ${threshold}::int) AS "effectiveLowStockThreshold"
    FROM products
    WHERE organization_id = ${organizationId}::uuid
      AND quantity_on_hand <= COALESCE(low_stock_threshold, ${threshold}::int)
    ORDER BY quantity_on_hand ASC, name ASC
    LIMIT ${safeLimit}
  `);

  return {
    organizationDefaultThreshold: threshold,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      quantityOnHand: Number(row.quantityOnHand),
      lowStockThreshold: row.lowStockThreshold === null ? null : Number(row.lowStockThreshold),
      effectiveLowStockThreshold: Number(row.effectiveLowStockThreshold),
      // Reuses the shared rule so the dashboard and the product list can never
      // disagree about what a product's status is.
      stockStatus: stockStatus(Number(row.quantityOnHand), row.lowStockThreshold, threshold),
    })),
  };
}

function toMoney(value: string | null | undefined): string {
  const num = Number(value ?? 0);
  return (Number.isFinite(num) ? num : 0).toFixed(2);
}
