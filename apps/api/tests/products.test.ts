import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  createProduct,
  createTenant,
  prisma,
  request,
  resetDatabase,
  unique,
  type TestTenant,
} from './helpers';

describe('Product CRUD', () => {
  let tenant: TestTenant;

  beforeAll(async () => {
    await resetDatabase();
    tenant = await createTenant();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // Scenarios 4 & 5
  it('creates a product and reads it back', async () => {
    const sku = unique('CREATE').toUpperCase();

    const created = await request(app)
      .post('/products')
      .set('Cookie', tenant.cookie)
      .send({
        name: 'Ceramic Dripper',
        sku,
        description: 'Pour-over cone',
        quantityOnHand: 24,
        costPrice: 9.5,
        sellingPrice: 21.95,
        lowStockThreshold: 5,
      })
      .expect(201);

    const product = created.body.data.product;

    expect(product.name).toBe('Ceramic Dripper');
    expect(product.sku).toBe(sku);
    expect(product.quantityOnHand).toBe(24);
    // Money is serialised as fixed-2 strings, not floats.
    expect(product.costPrice).toBe('9.50');
    expect(product.sellingPrice).toBe('21.95');
    expect(product.lowStockThreshold).toBe(5);
    expect(product.effectiveLowStockThreshold).toBe(5);
    expect(product.stockStatus).toBe('IN_STOCK');
    // The tenant comes from the session, not the request.
    expect(product.organizationId).toBe(tenant.organizationId);

    const fetched = await request(app)
      .get(`/products/${product.id}`)
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(fetched.body.data.product.id).toBe(product.id);
  });

  it('stores monetary values as exact decimals', async () => {
    const product = await createProduct(tenant, { costPrice: '19.99', sellingPrice: '0.07' });

    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    // numeric(12,2) keeps the value exact — no binary floating-point drift.
    expect(row.costPrice.toFixed(2)).toBe('19.99');
    expect(row.sellingPrice.toFixed(2)).toBe('0.07');
  });

  // Scenario 8
  it('rejects a duplicate SKU within the same organization', async () => {
    const sku = unique('DUPE').toUpperCase();

    await createProduct(tenant, { sku });

    const response = await request(app)
      .post('/products')
      .set('Cookie', tenant.cookie)
      .send({ name: 'Another Product', sku, quantityOnHand: 1, costPrice: 1, sellingPrice: 2 })
      .expect(409);

    expect(response.body.error.code).toBe('DUPLICATE_SKU');
    expect(response.body.error.details.sku).toBeTruthy();
  });

  // Scenario 9
  it('allows the same SKU in two different organizations', async () => {
    const other = await createTenant();
    const sku = unique('SHARED').toUpperCase();

    const mine = await createProduct(tenant, { sku });
    const theirs = await createProduct(other, { sku });

    expect(mine.sku).toBe(sku);
    expect(theirs.sku).toBe(sku);
    // Same SKU, different rows, different tenants.
    expect(mine.id).not.toBe(theirs.id);
    expect(mine.organizationId).not.toBe(theirs.organizationId);
  });

  // Scenario 6
  it('updates every editable field', async () => {
    const product = await createProduct(tenant);
    const newSku = unique('UPDATED').toUpperCase();

    const response = await request(app)
      .patch(`/products/${product.id}`)
      .set('Cookie', tenant.cookie)
      .send({
        name: 'Renamed Product',
        sku: newSku,
        description: 'Updated description',
        quantityOnHand: 7,
        costPrice: 3.25,
        sellingPrice: 8.75,
        lowStockThreshold: 2,
      })
      .expect(200);

    const updated = response.body.data.product;

    expect(updated.name).toBe('Renamed Product');
    expect(updated.sku).toBe(newSku);
    expect(updated.description).toBe('Updated description');
    expect(updated.quantityOnHand).toBe(7);
    expect(updated.costPrice).toBe('3.25');
    expect(updated.sellingPrice).toBe('8.75');
    expect(updated.lowStockThreshold).toBe(2);
    expect(updated.stockStatus).toBe('IN_STOCK');
  });

  it('clears a product threshold back to the organization default', async () => {
    const product = await createProduct(tenant, { lowStockThreshold: 99, quantityOnHand: 50 });
    expect(product.effectiveLowStockThreshold).toBe(99);
    expect(product.stockStatus).toBe('LOW_STOCK');

    const response = await request(app)
      .patch(`/products/${product.id}`)
      .set('Cookie', tenant.cookie)
      .send({ lowStockThreshold: null })
      .expect(200);

    // Falls back to the organization default of 10.
    expect(response.body.data.product.lowStockThreshold).toBeNull();
    expect(response.body.data.product.effectiveLowStockThreshold).toBe(10);
    expect(response.body.data.product.stockStatus).toBe('IN_STOCK');
  });

  it('rejects a SKU that collides with another product on update', async () => {
    const first = await createProduct(tenant);
    const second = await createProduct(tenant);

    const response = await request(app)
      .patch(`/products/${second.id}`)
      .set('Cookie', tenant.cookie)
      .send({ sku: first.sku })
      .expect(409);

    expect(response.body.error.code).toBe('DUPLICATE_SKU');
  });

  it('allows updating a product while keeping its own SKU', async () => {
    const product = await createProduct(tenant);

    await request(app)
      .patch(`/products/${product.id}`)
      .set('Cookie', tenant.cookie)
      .send({ sku: product.sku, name: 'Same SKU New Name' })
      .expect(200);
  });

  // Scenario 7
  it('deletes a product', async () => {
    const product = await createProduct(tenant);

    await request(app)
      .delete(`/products/${product.id}`)
      .set('Cookie', tenant.cookie)
      .expect(200);

    await request(app)
      .get(`/products/${product.id}`)
      .set('Cookie', tenant.cookie)
      .expect(404);

    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
  });

  // Scenario 11
  it('rejects negative and non-integer quantities', async () => {
    const negative = await request(app)
      .post('/products')
      .set('Cookie', tenant.cookie)
      .send({
        name: 'Negative',
        sku: unique('NEG').toUpperCase(),
        quantityOnHand: -5,
        costPrice: 1,
        sellingPrice: 2,
      })
      .expect(422);

    expect(negative.body.error.details.quantityOnHand).toBeTruthy();

    const fractional = await request(app)
      .post('/products')
      .set('Cookie', tenant.cookie)
      .send({
        name: 'Fractional',
        sku: unique('FRAC').toUpperCase(),
        quantityOnHand: 1.5,
        costPrice: 1,
        sellingPrice: 2,
      })
      .expect(422);

    expect(fractional.body.error.details.quantityOnHand).toBeTruthy();
  });

  it('rejects negative prices and a missing name or SKU', async () => {
    const negativePrice = await request(app)
      .post('/products')
      .set('Cookie', tenant.cookie)
      .send({
        name: 'Bad Price',
        sku: unique('BADP').toUpperCase(),
        quantityOnHand: 1,
        costPrice: -1,
        sellingPrice: 2,
      })
      .expect(422);

    expect(negativePrice.body.error.details.costPrice).toBeTruthy();

    const missing = await request(app)
      .post('/products')
      .set('Cookie', tenant.cookie)
      .send({ quantityOnHand: 1, costPrice: 1, sellingPrice: 2 })
      .expect(422);

    expect(missing.body.error.details.name).toBeTruthy();
    expect(missing.body.error.details.sku).toBeTruthy();
  });

  it('rejects a malformed product id with 422 rather than a database error', async () => {
    await request(app).get('/products/not-a-uuid').set('Cookie', tenant.cookie).expect(422);
  });
});

describe('Product listing: search, sort, pagination', () => {
  let tenant: TestTenant;

  beforeAll(async () => {
    await resetDatabase();
    tenant = await createTenant();

    // A small deterministic catalog to assert against.
    await createProduct(tenant, { name: 'Alpha Widget', sku: 'AAA-001', quantityOnHand: 100, sellingPrice: 5 });
    await createProduct(tenant, { name: 'Beta Widget', sku: 'BBB-002', quantityOnHand: 4, sellingPrice: 50 });
    await createProduct(tenant, { name: 'Gamma Gadget', sku: 'CCC-003', quantityOnHand: 0, sellingPrice: 15 });
    await createProduct(tenant, { name: 'Delta Gizmo', sku: 'DDD-004', quantityOnHand: 7, sellingPrice: 25, lowStockThreshold: 20 });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it('returns all products with pagination metadata', async () => {
    const response = await request(app).get('/products').set('Cookie', tenant.cookie).expect(200);

    expect(response.body.data.products).toHaveLength(4);
    expect(response.body.meta.pagination).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 4,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it('searches by product name, case-insensitively', async () => {
    const response = await request(app)
      .get('/products')
      .query({ search: 'widget' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(response.body.data.products).toHaveLength(2);
    expect(
      response.body.data.products.map((p: { name: string }) => p.name).sort(),
    ).toEqual(['Alpha Widget', 'Beta Widget']);
  });

  it('searches by SKU', async () => {
    const response = await request(app)
      .get('/products')
      .query({ search: 'ccc' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.products[0].sku).toBe('CCC-003');
  });

  it('returns an empty list for a search that matches nothing', async () => {
    const response = await request(app)
      .get('/products')
      .query({ search: 'nonexistent-xyz' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(response.body.data.products).toEqual([]);
    expect(response.body.meta.pagination.total).toBe(0);
    // Never report zero pages, so the UI can always render "page 1 of 1".
    expect(response.body.meta.pagination.totalPages).toBe(1);
  });

  it('sorts ascending and descending', async () => {
    const ascending = await request(app)
      .get('/products')
      .query({ sortBy: 'name', sortOrder: 'asc' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(ascending.body.data.products.map((p: { name: string }) => p.name)).toEqual([
      'Alpha Widget',
      'Beta Widget',
      'Delta Gizmo',
      'Gamma Gadget',
    ]);

    const descending = await request(app)
      .get('/products')
      .query({ sortBy: 'quantityOnHand', sortOrder: 'desc' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(
      descending.body.data.products.map((p: { quantityOnHand: number }) => p.quantityOnHand),
    ).toEqual([100, 7, 4, 0]);
  });

  it('paginates without overlapping or dropping rows', async () => {
    const first = await request(app)
      .get('/products')
      .query({ page: 1, pageSize: 2, sortBy: 'name', sortOrder: 'asc' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    const second = await request(app)
      .get('/products')
      .query({ page: 2, pageSize: 2, sortBy: 'name', sortOrder: 'asc' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(first.body.data.products).toHaveLength(2);
    expect(second.body.data.products).toHaveLength(2);
    expect(first.body.meta.pagination).toMatchObject({ totalPages: 2, hasNextPage: true });
    expect(second.body.meta.pagination).toMatchObject({ hasPreviousPage: true, hasNextPage: false });

    const ids = [
      ...first.body.data.products.map((p: { id: string }) => p.id),
      ...second.body.data.products.map((p: { id: string }) => p.id),
    ];
    expect(new Set(ids).size).toBe(4);
  });

  it('filters by stock status using the effective threshold', async () => {
    const outOfStock = await request(app)
      .get('/products')
      .query({ status: 'OUT_OF_STOCK' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(outOfStock.body.data.products.map((p: { sku: string }) => p.sku)).toEqual(['CCC-003']);

    const lowStock = await request(app)
      .get('/products')
      .query({ status: 'LOW_STOCK' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    // Beta (4 <= default 10) and Delta (7 <= its own 20); Gamma is out of stock.
    expect(lowStock.body.data.products.map((p: { sku: string }) => p.sku).sort()).toEqual([
      'BBB-002',
      'DDD-004',
    ]);

    const inStock = await request(app)
      .get('/products')
      .query({ status: 'IN_STOCK' })
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(inStock.body.data.products.map((p: { sku: string }) => p.sku)).toEqual(['AAA-001']);
  });

  it('rejects invalid list parameters', async () => {
    await request(app)
      .get('/products')
      .query({ sortBy: 'password' })
      .set('Cookie', tenant.cookie)
      .expect(422);

    await request(app)
      .get('/products')
      .query({ page: 0 })
      .set('Cookie', tenant.cookie)
      .expect(422);

    await request(app)
      .get('/products')
      .query({ pageSize: 5000 })
      .set('Cookie', tenant.cookie)
      .expect(422);
  });
});
