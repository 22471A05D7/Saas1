import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  app,
  createProduct,
  createTenant,
  prisma,
  request,
  resetDatabase,
  type TestTenant,
} from './helpers';

describe('Dashboard and organization settings', () => {
  let tenant: TestTenant;

  // A fresh tenant per test keeps the aggregate assertions exact.
  beforeEach(async () => {
    await resetDatabase();
    tenant = await createTenant();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // Scenarios 12 & 13
  it('computes summary statistics correctly', async () => {
    // Organization default threshold is 10.
    await createProduct(tenant, { name: 'Healthy', quantityOnHand: 100, costPrice: 2, sellingPrice: 5 });
    await createProduct(tenant, { name: 'Low', quantityOnHand: 8, costPrice: 1, sellingPrice: 3 });
    await createProduct(tenant, { name: 'AtThreshold', quantityOnHand: 10, costPrice: 1, sellingPrice: 4 });
    await createProduct(tenant, { name: 'Empty', quantityOnHand: 0, costPrice: 1, sellingPrice: 9 });

    const response = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', tenant.cookie)
      .expect(200);

    const summary = response.body.data.summary;

    expect(summary.totalProducts).toBe(4);
    expect(summary.totalStockUnits).toBe(118);
    // "At or below threshold" is inclusive, so quantity 10 counts as low.
    expect(summary.lowStockProducts).toBe(2);
    expect(summary.outOfStockProducts).toBe(1);

    // 100*2 + 8*1 + 10*1 + 0*1 = 218
    expect(summary.inventoryCostValue).toBe('218.00');
    // 100*5 + 8*3 + 10*4 + 0*9 = 564
    expect(summary.inventoryRetailValue).toBe('564.00');
  });

  it('reports zeroes for an organization with no products', async () => {
    const response = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(response.body.data.summary).toMatchObject({
      totalProducts: 0,
      totalStockUnits: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inventoryCostValue: '0.00',
      inventoryRetailValue: '0.00',
    });
  });

  it('counts out-of-stock separately from low stock', async () => {
    await createProduct(tenant, { name: 'Empty', quantityOnHand: 0 });

    const response = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', tenant.cookie)
      .expect(200);

    // A zero-quantity product is out of stock, never double-counted as low.
    expect(response.body.data.summary.outOfStockProducts).toBe(1);
    expect(response.body.data.summary.lowStockProducts).toBe(0);
  });

  it('prefers a product threshold over the organization default', async () => {
    // 50 units is healthy against the default of 10, but low against its own 60.
    await createProduct(tenant, { name: 'Custom', quantityOnHand: 50, lowStockThreshold: 60 });
    // 12 units is healthy against the default of 10 and against its own 5.
    await createProduct(tenant, { name: 'Override', quantityOnHand: 12, lowStockThreshold: 5 });

    const response = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(response.body.data.summary.lowStockProducts).toBe(1);

    const lowStock = await request(app)
      .get('/dashboard/low-stock')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(lowStock.body.data.items).toHaveLength(1);
    expect(lowStock.body.data.items[0].name).toBe('Custom');
    expect(lowStock.body.data.items[0].effectiveLowStockThreshold).toBe(60);
    expect(lowStock.body.data.items[0].lowStockThreshold).toBe(60);
  });

  it('lists low-stock products including out-of-stock ones, lowest first', async () => {
    await createProduct(tenant, { name: 'Healthy', quantityOnHand: 100 });
    await createProduct(tenant, { name: 'Low', quantityOnHand: 8 });
    await createProduct(tenant, { name: 'Empty', quantityOnHand: 0 });

    const response = await request(app)
      .get('/dashboard/low-stock')
      .set('Cookie', tenant.cookie)
      .expect(200);

    const items = response.body.data.items;

    expect(items).toHaveLength(2);
    // Ordered by quantity ascending so the most urgent is first.
    expect(items.map((i: { name: string }) => i.name)).toEqual(['Empty', 'Low']);
    expect(items[0].stockStatus).toBe('OUT_OF_STOCK');
    expect(items[1].stockStatus).toBe('LOW_STOCK');
    // A null product threshold is reported alongside the resolved default.
    expect(items[1].lowStockThreshold).toBeNull();
    expect(items[1].effectiveLowStockThreshold).toBe(10);
  });

  // Scenarios 14 & 15
  it('applies an updated organization default to low-stock calculations', async () => {
    await createProduct(tenant, { name: 'Borderline', quantityOnHand: 15 });

    // Healthy against the default of 10.
    const before = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(before.body.data.summary.lowStockProducts).toBe(0);

    const updated = await request(app)
      .patch('/settings')
      .set('Cookie', tenant.cookie)
      .send({ defaultLowStockThreshold: 20 })
      .expect(200);

    expect(updated.body.data.organization.defaultLowStockThreshold).toBe(20);

    // The same product is now low, with no change to the product itself —
    // the default is resolved at query time, not copied onto products.
    const after = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(after.body.data.summary.lowStockProducts).toBe(1);

    const lowStock = await request(app)
      .get('/dashboard/low-stock')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(lowStock.body.data.items).toHaveLength(1);
    expect(lowStock.body.data.items[0].effectiveLowStockThreshold).toBe(20);

    // The product listing agrees with the dashboard.
    const products = await request(app)
      .get('/products')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(products.body.data.products[0].stockStatus).toBe('LOW_STOCK');
    expect(products.body.data.products[0].effectiveLowStockThreshold).toBe(20);
  });

  it('reads and updates organization settings', async () => {
    const read = await request(app).get('/settings').set('Cookie', tenant.cookie).expect(200);

    expect(read.body.data.organization.id).toBe(tenant.organizationId);
    expect(read.body.data.organization.defaultLowStockThreshold).toBe(10);
    expect(read.body.data.stats.userCount).toBe(1);
    expect(read.body.data.stats.productCount).toBe(0);

    const updated = await request(app)
      .patch('/settings')
      .set('Cookie', tenant.cookie)
      .send({ name: 'Renamed Organization', defaultLowStockThreshold: 25 })
      .expect(200);

    expect(updated.body.data.organization.name).toBe('Renamed Organization');
    expect(updated.body.data.organization.defaultLowStockThreshold).toBe(25);

    // The change is persisted, not just echoed back.
    const row = await prisma.organization.findUniqueOrThrow({
      where: { id: tenant.organizationId },
    });
    expect(row.name).toBe('Renamed Organization');
    expect(row.defaultLowStockThreshold).toBe(25);
  });

  it('rejects invalid settings', async () => {
    const negative = await request(app)
      .patch('/settings')
      .set('Cookie', tenant.cookie)
      .send({ defaultLowStockThreshold: -5 })
      .expect(422);

    expect(negative.body.error.details.defaultLowStockThreshold).toBeTruthy();

    await request(app)
      .patch('/settings')
      .set('Cookie', tenant.cookie)
      .send({ name: 'A' })
      .expect(422);

    // An empty payload has nothing to apply.
    await request(app).patch('/settings').set('Cookie', tenant.cookie).send({}).expect(422);
  });

  it('allows a threshold of zero, which flags only out-of-stock products', async () => {
    await createProduct(tenant, { name: 'One Left', quantityOnHand: 1 });
    await createProduct(tenant, { name: 'Empty', quantityOnHand: 0 });

    await request(app)
      .patch('/settings')
      .set('Cookie', tenant.cookie)
      .send({ defaultLowStockThreshold: 0 })
      .expect(200);

    const response = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', tenant.cookie)
      .expect(200);

    expect(response.body.data.summary.lowStockProducts).toBe(0);
    expect(response.body.data.summary.outOfStockProducts).toBe(1);
  });
});
