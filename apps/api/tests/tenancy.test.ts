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

/**
 * Tenant isolation.
 *
 * The central security property of the system: a user must never be able to
 * read, modify, or even confirm the existence of another organization's data,
 * including by guessing a valid product id.
 */
describe('Tenant isolation', () => {
  let alice: TestTenant;
  let bob: TestTenant;
  let aliceProduct: { id: string; sku: string };

  beforeAll(async () => {
    await resetDatabase();
    alice = await createTenant({ organizationName: 'Alice Supplies' });
    bob = await createTenant({ organizationName: 'Bob Trading' });
    aliceProduct = await createProduct(alice, { name: 'Alice Only', quantityOnHand: 30 });
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // Scenario 16
  it('hides another organization products from the list', async () => {
    const bobList = await request(app).get('/products').set('Cookie', bob.cookie).expect(200);

    expect(bobList.body.data.products).toHaveLength(0);

    const aliceList = await request(app).get('/products').set('Cookie', alice.cookie).expect(200);

    expect(aliceList.body.data.products).toHaveLength(1);
    expect(aliceList.body.data.products[0].id).toBe(aliceProduct.id);
  });

  it('returns 404 — not 403 — when reading another organization product by id', async () => {
    const response = await request(app)
      .get(`/products/${aliceProduct.id}`)
      .set('Cookie', bob.cookie)
      .expect(404);

    // 404 rather than 403, so a valid id in another tenant is indistinguishable
    // from one that does not exist and cannot be used to probe for data.
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('refuses to update another organization product', async () => {
    await request(app)
      .patch(`/products/${aliceProduct.id}`)
      .set('Cookie', bob.cookie)
      .send({ name: 'Hijacked' })
      .expect(404);

    // The record must be completely unchanged.
    const row = await prisma.product.findUniqueOrThrow({ where: { id: aliceProduct.id } });
    expect(row.name).toBe('Alice Only');
  });

  it('refuses to delete another organization product', async () => {
    await request(app)
      .delete(`/products/${aliceProduct.id}`)
      .set('Cookie', bob.cookie)
      .expect(404);

    expect(await prisma.product.findUnique({ where: { id: aliceProduct.id } })).not.toBeNull();
  });

  it('refuses to adjust stock on another organization product', async () => {
    await request(app)
      .patch(`/products/${aliceProduct.id}/stock`)
      .set('Cookie', bob.cookie)
      .send({ type: 'decrease', quantity: 10 })
      .expect(404);

    const row = await prisma.product.findUniqueOrThrow({ where: { id: aliceProduct.id } });
    expect(row.quantityOnHand).toBe(30);
  });

  it('ignores an organizationId supplied in a create request body', async () => {
    const sku = unique('SPOOF').toUpperCase();

    const response = await request(app)
      .post('/products')
      .set('Cookie', bob.cookie)
      .send({
        name: 'Spoof Attempt',
        sku,
        quantityOnHand: 1,
        costPrice: 1,
        sellingPrice: 2,
        // A client trying to plant the product in Alice's tenant.
        organizationId: alice.organizationId,
      })
      .expect(201);

    // The tenant is taken from the session, so it lands in Bob's organization.
    expect(response.body.data.product.organizationId).toBe(bob.organizationId);
    expect(response.body.data.product.organizationId).not.toBe(alice.organizationId);
  });

  it('ignores an organizationId supplied in an update request body', async () => {
    const product = await createProduct(bob);

    const response = await request(app)
      .patch(`/products/${product.id}`)
      .set('Cookie', bob.cookie)
      .send({ name: 'Renamed', organizationId: alice.organizationId })
      .expect(200);

    expect(response.body.data.product.organizationId).toBe(bob.organizationId);
  });

  // Scenario 13
  it('scopes dashboard statistics to the caller organization', async () => {
    const aliceSummary = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', alice.cookie)
      .expect(200);

    const bobSummary = await request(app)
      .get('/dashboard/summary')
      .set('Cookie', bob.cookie)
      .expect(200);

    // Alice has her one product; Bob only sees the ones he created above.
    expect(aliceSummary.body.data.summary.totalProducts).toBe(1);
    expect(aliceSummary.body.data.summary.totalStockUnits).toBe(30);
    expect(aliceSummary.body.data.summary.organization.name).toBe('Alice Supplies');

    expect(bobSummary.body.data.summary.organization.name).toBe('Bob Trading');
    expect(bobSummary.body.data.summary.organization.id).toBe(bob.organizationId);
  });

  it('scopes settings reads and writes to the caller organization', async () => {
    const bobSettings = await request(app).get('/settings').set('Cookie', bob.cookie).expect(200);

    expect(bobSettings.body.data.organization.id).toBe(bob.organizationId);
    expect(bobSettings.body.data.organization.name).toBe('Bob Trading');

    await request(app)
      .patch('/settings')
      .set('Cookie', bob.cookie)
      .send({ name: 'Bob Trading Renamed' })
      .expect(200);

    // Alice's organization must be untouched by Bob's write.
    const aliceOrg = await prisma.organization.findUniqueOrThrow({
      where: { id: alice.organizationId },
    });
    expect(aliceOrg.name).toBe('Alice Supplies');
  });

  it('invalidates a session whose user has been deleted', async () => {
    const doomed = await createTenant();

    await request(app).get('/auth/me').set('Cookie', doomed.cookie).expect(200);

    await prisma.organization.delete({ where: { id: doomed.organizationId } });

    // The middleware re-reads the user on every request, so a token for a
    // deleted account stops working immediately.
    await request(app).get('/auth/me').set('Cookie', doomed.cookie).expect(401);
    await request(app).get('/products').set('Cookie', doomed.cookie).expect(401);
  });

  it('cascades deletion of an organization to its users and products', async () => {
    const temp = await createTenant();
    const product = await createProduct(temp);

    await prisma.organization.delete({ where: { id: temp.organizationId } });

    expect(await prisma.user.findUnique({ where: { id: temp.userId } })).toBeNull();
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
  });
});
