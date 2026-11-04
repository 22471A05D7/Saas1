import { Prisma } from '@prisma/client';
import { badRequest, duplicateSku, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { presentProduct, type ProductDto } from './products.presenter';
import type {
  CreateProductInput,
  ListProductsQuery,
  StockAdjustmentInput,
  UpdateProductInput,
} from './products.schemas';

/**
 * Product data access.
 *
 * Every function in this module takes `organizationId` as its first argument
 * and includes it in the query filter. The caller always supplies that value
 * from the verified session (see `tenant()` in the auth middleware), never from
 * request input — that combination is what enforces tenant isolation.
 */

async function organizationDefaultThreshold(organizationId: string): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { defaultLowStockThreshold: true },
  });

  if (!org) throw notFound('Organization not found');
  return org.defaultLowStockThreshold;
}

export interface ListResult {
  products: ProductDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export async function listProducts(
  organizationId: string,
  query: ListProductsQuery,
): Promise<ListResult> {
  const defaultThreshold = await organizationDefaultThreshold(organizationId);

  const where: Prisma.ProductWhereInput = { organizationId };

  // One search box matches either the product name or the SKU.
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Stock status depends on COALESCE(low_stock_threshold, org default), a
  // column-to-column comparison that Prisma's `where` cannot express. The
  // matching ids are resolved with a parameterized, organization-scoped SQL
  // query and folded back into the Prisma filter, so search, sorting, and
  // pagination all stay on a single code path.
  if (query.status !== 'ALL') {
    where.id = { in: await matchingIdsForStatus(organizationId, query.status, defaultThreshold) };
  }

  const skip = (query.page - 1) * query.pageSize;

  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      // A unique tiebreaker keeps pagination stable when the sort key repeats.
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      skip,
      take: query.pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  return {
    products: rows.map((row) => presentProduct(row, defaultThreshold)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      hasPreviousPage: query.page > 1,
      hasNextPage: query.page < totalPages,
    },
  };
}

async function matchingIdsForStatus(
  organizationId: string,
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK',
  defaultThreshold: number,
): Promise<string[]> {
  const threshold = Prisma.sql`COALESCE(low_stock_threshold, ${defaultThreshold}::int)`;

  const condition =
    status === 'OUT_OF_STOCK'
      ? Prisma.sql`quantity_on_hand <= 0`
      : status === 'LOW_STOCK'
        ? Prisma.sql`quantity_on_hand > 0 AND quantity_on_hand <= ${threshold}`
        : Prisma.sql`quantity_on_hand > ${threshold}`;

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM products
      WHERE organization_id = ${organizationId}::uuid AND ${condition}
    `,
  );

  return rows.map((row) => row.id);
}

export async function getProduct(organizationId: string, id: string): Promise<ProductDto> {
  const defaultThreshold = await organizationDefaultThreshold(organizationId);

  // Filtering on id *and* organizationId makes another tenant's product
  // indistinguishable from one that does not exist.
  const product = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!product) throw notFound('Product not found');

  return presentProduct(product, defaultThreshold);
}

export async function createProduct(
  organizationId: string,
  input: CreateProductInput,
): Promise<ProductDto> {
  const defaultThreshold = await organizationDefaultThreshold(organizationId);

  // A pre-check produces a friendly field-level message; the composite unique
  // index on (organization_id, sku) is the real guarantee and surfaces as P2002
  // through the error middleware if two creates race.
  const existing = await prisma.product.findUnique({
    where: { organizationId_sku: { organizationId, sku: input.sku } },
    select: { id: true },
  });

  if (existing) {
    throw duplicateSku();
  }

  const product = await prisma.product.create({
    data: {
      // The tenant comes from the session. Any organizationId present in the
      // request body was already stripped by the validation layer.
      organizationId,
      name: input.name,
      sku: input.sku,
      description: input.description ?? null,
      quantityOnHand: input.quantityOnHand,
      costPrice: new Prisma.Decimal(input.costPrice),
      sellingPrice: new Prisma.Decimal(input.sellingPrice),
      lowStockThreshold: input.lowStockThreshold ?? null,
    },
  });

  return presentProduct(product, defaultThreshold);
}

export async function updateProduct(
  organizationId: string,
  id: string,
  input: UpdateProductInput,
): Promise<ProductDto> {
  const defaultThreshold = await organizationDefaultThreshold(organizationId);

  const existing = await prisma.product.findFirst({
    where: { id, organizationId },
    select: { id: true, sku: true },
  });

  if (!existing) throw notFound('Product not found');

  if (input.sku && input.sku !== existing.sku) {
    const clash = await prisma.product.findUnique({
      where: { organizationId_sku: { organizationId, sku: input.sku } },
      select: { id: true },
    });

    if (clash && clash.id !== id) {
      throw duplicateSku();
    }
  }

  const data: Prisma.ProductUpdateInput = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.sku !== undefined) data.sku = input.sku;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.quantityOnHand !== undefined) data.quantityOnHand = input.quantityOnHand;
  if (input.costPrice !== undefined) data.costPrice = new Prisma.Decimal(input.costPrice);
  if (input.sellingPrice !== undefined) data.sellingPrice = new Prisma.Decimal(input.sellingPrice);
  if (input.lowStockThreshold !== undefined) {
    data.lowStockThreshold = input.lowStockThreshold ?? null;
  }

  // `updateMany` keeps organizationId in the WHERE clause, so the tenant filter
  // holds even if a product id from another organization were guessed.
  const result = await prisma.product.updateMany({ where: { id, organizationId }, data });
  if (result.count === 0) throw notFound('Product not found');

  const updated = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!updated) throw notFound('Product not found');

  return presentProduct(updated, defaultThreshold);
}

export async function deleteProduct(organizationId: string, id: string): Promise<void> {
  const result = await prisma.product.deleteMany({ where: { id, organizationId } });
  if (result.count === 0) throw notFound('Product not found');
}

/**
 * Applies a stock adjustment.
 *
 * Relative adjustments use a single conditional UPDATE — `quantity_on_hand =
 * quantity_on_hand + delta`, guarded by a WHERE clause that rejects a negative
 * result. PostgreSQL evaluates that atomically and row-locks the product, so
 * two concurrent decrements can never both read the same starting quantity;
 * there is no read-modify-write window to lose an update in. A request that
 * would drive stock below zero matches no rows and is reported as a validation
 * failure rather than silently clamping.
 */
export async function adjustStock(
  organizationId: string,
  id: string,
  input: StockAdjustmentInput,
): Promise<ProductDto> {
  const defaultThreshold = await organizationDefaultThreshold(organizationId);

  const updated = await prisma.$transaction(async (tx) => {
    const exists = await tx.product.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!exists) throw notFound('Product not found');

    const note = input.note ?? null;

    if (input.type === 'set') {
      await tx.product.updateMany({
        where: { id, organizationId },
        data: { quantityOnHand: input.quantity, lastStockNote: note },
      });
    } else {
      const delta = input.type === 'increase' ? input.quantity : -input.quantity;

      const result = await tx.product.updateMany({
        where: {
          id,
          organizationId,
          // The guard that makes this safe under concurrency: the row only
          // matches while there is enough stock to cover the decrement.
          ...(delta < 0 ? { quantityOnHand: { gte: input.quantity } } : {}),
        },
        data: { quantityOnHand: { increment: delta }, lastStockNote: note },
      });

      if (result.count === 0) {
        const current = await tx.product.findFirst({
          where: { id, organizationId },
          select: { quantityOnHand: true },
        });

        throw badRequest(
          `Cannot remove ${input.quantity} units - only ${current?.quantityOnHand ?? 0} in stock`,
          { quantity: 'Stock cannot go below zero' },
        );
      }
    }

    return tx.product.findFirst({ where: { id, organizationId } });
  });

  if (!updated) throw notFound('Product not found');

  return presentProduct(updated, defaultThreshold);
}
