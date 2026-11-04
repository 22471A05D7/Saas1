import { z } from 'zod';

/** Money accepts a number or numeric string and is normalised to 2 decimals. */
const money = z
  .union([z.number(), z.string().trim().min(1)])
  .superRefine((value, ctx) => {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a valid amount' });
      return;
    }
    if (num < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be zero or greater' });
    }
    if (num > 99_999_999.99) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount is too large' });
    }
  })
  .transform((value) => {
    const num = typeof value === 'number' ? value : Number(value);
    // Round to the 2 decimal places the column stores.
    return Math.round(num * 100) / 100;
  });

const quantity = z.coerce
  .number({ invalid_type_error: 'Must be a whole number' })
  .int('Must be a whole number')
  .min(0, 'Quantity cannot be negative')
  .max(100_000_000, 'Quantity is too large');

const threshold = z.coerce
  .number({ invalid_type_error: 'Must be a whole number' })
  .int('Must be a whole number')
  .min(0, 'Threshold cannot be negative')
  .max(100_000_000, 'Threshold is too large');

/** Empty strings from HTML forms are treated as "not provided". */
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null || v === undefined ? null : v), schema.nullable());

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(255),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(100)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._\-\/ ]*$/, 'SKU may only contain letters, numbers, and . _ - /'),
  description: emptyToNull(z.string().trim().max(5000)).optional(),
  quantityOnHand: quantity.default(0),
  costPrice: money.default(0),
  sellingPrice: money.default(0),
  lowStockThreshold: emptyToNull(threshold).optional(),
});

/** Every field optional — but at least one must be present. */
export const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Provide at least one field to update' },
);

export const stockAdjustmentSchema = z.object({
  type: z.enum(['increase', 'decrease', 'set'], {
    errorMap: () => ({ message: 'Type must be increase, decrease, or set' }),
  }),
  quantity: quantity,
  note: emptyToNull(z.string().trim().max(500)).optional(),
});

export const productIdSchema = z.object({
  id: z.string().uuid('Invalid product id'),
});

export const listProductsSchema = z.object({
  search: z.string().trim().max(255).optional(),
  status: z.enum(['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z
    .enum(['name', 'sku', 'quantityOnHand', 'sellingPrice', 'costPrice', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type ListProductsQuery = z.infer<typeof listProductsSchema>;
