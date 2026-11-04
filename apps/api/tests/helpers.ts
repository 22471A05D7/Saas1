import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app: Express = createApp();

/** Removes all tenant data. Cascades handle users and products. */
export async function resetDatabase(): Promise<void> {
  await prisma.organization.deleteMany({});
}

let counter = 0;

/** Unique-per-call identifiers, so tests never collide on the email index. */
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${process.pid}-${counter}`;
}

export interface TestTenant {
  token: string;
  cookie: string;
  userId: string;
  organizationId: string;
  email: string;
}

/**
 * Registers a fresh organization + user and returns credentials for it.
 * Each tenant is fully isolated, which is what the isolation tests rely on.
 */
export async function createTenant(
  overrides: Partial<{ password: string; organizationName: string; name: string }> = {},
): Promise<TestTenant> {
  const email = `${unique('user')}@example.com`;
  const password = overrides.password ?? 'Str0ngPassw0rd!';

  const response = await request(app)
    .post('/auth/register')
    .send({
      name: overrides.name ?? 'Test User',
      email,
      password,
      confirmPassword: password,
      organizationName: overrides.organizationName ?? unique('Org'),
    })
    .expect(201);

  const { user, token } = response.body.data;

  return {
    token,
    cookie: `stockflow_token=${token}`,
    userId: user.id,
    organizationId: user.organizationId,
    email,
  };
}

/** Creates a product for a tenant and returns the API representation. */
export async function createProduct(
  tenant: TestTenant,
  overrides: Record<string, unknown> = {},
) {
  const response = await request(app)
    .post('/products')
    .set('Cookie', tenant.cookie)
    .send({
      name: 'Test Product',
      sku: unique('SKU').toUpperCase(),
      quantityOnHand: 50,
      costPrice: 10.5,
      sellingPrice: 24.99,
      ...overrides,
    })
    .expect(201);

  return response.body.data.product;
}

export { prisma, request };
