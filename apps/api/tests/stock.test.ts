import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  app,
  createProduct,
  createTenant,
  prisma,
  request,
  resetDatabase,
  type TestTenant,
} from './helpers';

describe('Stock adjustments', () => {
  let tenant: TestTenant;

  beforeAll(async () => {
    await resetDatabase();
    tenant = await createTenant();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // Scenario 10
  it('increases stock', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 10 });

    const response = await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'increase', quantity: 15, note: 'Received PO #1042' })
      .expect(200);

    expect(response.body.data.product.quantityOnHand).toBe(25);
    expect(response.body.data.product.lastStockNote).toBe('Received PO #1042');
  });

  it('decreases stock', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 10 });

    const response = await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'decrease', quantity: 4 })
      .expect(200);

    expect(response.body.data.product.quantityOnHand).toBe(6);
  });

  it('sets an absolute quantity', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 10 });

    const response = await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'set', quantity: 42, note: 'Cycle count' })
      .expect(200);

    expect(response.body.data.product.quantityOnHand).toBe(42);
  });

  it('accepts an adjustment with no note', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 5 });

    const response = await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'increase', quantity: 1 })
      .expect(200);

    expect(response.body.data.product.quantityOnHand).toBe(6);
    expect(response.body.data.product.lastStockNote).toBeNull();
  });

  // Scenario 11
  it('refuses to drive stock below zero and leaves the quantity untouched', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 5 });

    const response = await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'decrease', quantity: 6 })
      .expect(400);

    expect(response.body.error.details.quantity).toBeTruthy();

    // The rejected adjustment must not have been partially applied.
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.quantityOnHand).toBe(5);
  });

  it('allows a decrease down to exactly zero', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 5 });

    const response = await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'decrease', quantity: 5 })
      .expect(200);

    expect(response.body.data.product.quantityOnHand).toBe(0);
    expect(response.body.data.product.stockStatus).toBe('OUT_OF_STOCK');
  });

  it('rejects a negative quantity and an unknown adjustment type', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 5 });

    await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'increase', quantity: -3 })
      .expect(422);

    await request(app)
      .patch(`/products/${product.id}/stock`)
      .set('Cookie', tenant.cookie)
      .send({ type: 'obliterate', quantity: 3 })
      .expect(422);
  });

  // Scenario 18 — the critical concurrency guarantee.
  it('keeps the quantity correct under concurrent decrements', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 100 });

    // 20 simultaneous decrements of 5 should land on exactly 0, never a value
    // in between. A naive read-modify-write would lose updates here.
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app)
          .patch(`/products/${product.id}/stock`)
          .set('Cookie', tenant.cookie)
          .send({ type: 'decrease', quantity: 5 }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 200).length;
    expect(succeeded).toBe(20);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.quantityOnHand).toBe(0);
  });

  it('keeps the quantity correct under concurrent increments', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 0 });

    await Promise.all(
      Array.from({ length: 25 }, () =>
        request(app)
          .patch(`/products/${product.id}/stock`)
          .set('Cookie', tenant.cookie)
          .send({ type: 'increase', quantity: 2 })
          .expect(200),
      ),
    );

    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.quantityOnHand).toBe(50);
  });

  it('never oversells when concurrent requests exceed available stock', async () => {
    const product = await createProduct(tenant, { quantityOnHand: 10 });

    // 10 concurrent requests for 3 units each want 30 units from a stock of 10.
    // At most 3 can succeed, and the final quantity must never be negative.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .patch(`/products/${product.id}/stock`)
          .set('Cookie', tenant.cookie)
          .send({ type: 'decrease', quantity: 3 }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 200).length;
    const rejected = results.filter((r) => r.status === 400).length;

    expect(succeeded).toBe(3);
    expect(rejected).toBe(7);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(row.quantityOnHand).toBe(1);
    expect(row.quantityOnHand).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 for a stock adjustment on an unknown product', async () => {
    await request(app)
      .patch('/products/00000000-0000-4000-8000-000000000000/stock')
      .set('Cookie', tenant.cookie)
      .send({ type: 'increase', quantity: 1 })
      .expect(404);
  });
});
