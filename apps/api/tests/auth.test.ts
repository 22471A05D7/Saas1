import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, createTenant, prisma, request, resetDatabase, unique } from './helpers';

describe('Authentication', () => {
  beforeAll(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // Scenarios 1 & 2
  it('registers a user and creates their organization in one transaction', async () => {
    const email = `${unique('owner')}@example.com`;

    const response = await request(app)
      .post('/auth/register')
      .send({
        name: 'Ada Lovelace',
        email,
        password: 'Str0ngPassw0rd!',
        confirmPassword: 'Str0ngPassw0rd!',
        organizationName: 'Analytical Engines Ltd',
      })
      .expect(201);

    const { user } = response.body.data;

    expect(response.body.success).toBe(true);
    expect(user.email).toBe(email);
    expect(user.organizationId).toBeTruthy();
    expect(user.organization.name).toBe('Analytical Engines Ltd');
    // The organization default is applied without the client supplying it.
    expect(user.organization.defaultLowStockThreshold).toBe(10);

    // The session cookie is set, httpOnly, and scoped to the whole site.
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('stockflow_token='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
    });
    expect(organization).not.toBeNull();
  });

  it('never returns or stores the password in plaintext', async () => {
    const email = `${unique('hash')}@example.com`;
    const password = 'Str0ngPassw0rd!';

    const response = await request(app)
      .post('/auth/register')
      .send({
        name: 'Grace Hopper',
        email,
        password,
        confirmPassword: password,
        organizationName: unique('Org'),
      })
      .expect(201);

    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(response.body.data.user.password).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored?.password).not.toBe(password);
    // bcrypt hashes are prefixed with the algorithm and cost factor.
    expect(stored?.password).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('rejects a duplicate email', async () => {
    const email = `${unique('dupe')}@example.com`;
    const payload = {
      name: 'First User',
      email,
      password: 'Str0ngPassw0rd!',
      confirmPassword: 'Str0ngPassw0rd!',
      organizationName: unique('Org'),
    };

    await request(app).post('/auth/register').send(payload).expect(201);

    const response = await request(app)
      .post('/auth/register')
      .send({ ...payload, organizationName: unique('Org') })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_TAKEN');
    expect(response.body.error.details.email).toBeTruthy();
  });

  it('rejects mismatched passwords and weak passwords', async () => {
    const mismatch = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: `${unique('mismatch')}@example.com`,
        password: 'Str0ngPassw0rd!',
        confirmPassword: 'DifferentPassword!',
        organizationName: unique('Org'),
      })
      .expect(422);

    expect(mismatch.body.error.details.confirmPassword).toBe('Passwords do not match');

    const weak = await request(app)
      .post('/auth/register')
      .send({
        name: 'Test User',
        email: `${unique('weak')}@example.com`,
        password: 'short',
        confirmPassword: 'short',
        organizationName: unique('Org'),
      })
      .expect(422);

    expect(weak.body.error.details.password).toBeTruthy();
  });

  // Scenario 3
  it('logs in, identifies the session, and logs out', async () => {
    const password = 'Str0ngPassw0rd!';
    const email = `${unique('login')}@example.com`;

    await request(app)
      .post('/auth/register')
      .send({
        name: 'Login User',
        email,
        password,
        confirmPassword: password,
        organizationName: unique('Org'),
      })
      .expect(201);

    const login = await request(app).post('/auth/login').send({ email, password }).expect(200);

    const cookie = (login.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toContain('stockflow_token=');

    const me = await request(app).get('/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.data.user.email).toBe(email);
    expect(me.body.data.user.password).toBeUndefined();

    const logout = await request(app).post('/auth/logout').set('Cookie', cookie).expect(200);

    // Logout clears the cookie by setting it to an empty value.
    const cleared = logout.headers['set-cookie'] as unknown as string[];
    expect(cleared.some((c) => /stockflow_token=;|stockflow_token=\s*;/.test(c))).toBe(true);
  });

  it('rejects wrong credentials without revealing which part was wrong', async () => {
    const password = 'Str0ngPassw0rd!';
    const email = `${unique('creds')}@example.com`;

    await request(app)
      .post('/auth/register')
      .send({
        name: 'Creds User',
        email,
        password,
        confirmPassword: password,
        organizationName: unique('Org'),
      })
      .expect(201);

    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email, password: 'WrongPassword!' })
      .expect(401);

    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: `${unique('ghost')}@example.com`, password })
      .expect(401);

    // Identical messages mean the endpoint cannot be used to enumerate accounts.
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(wrongPassword.body.error.message).toBe('Invalid email or password');
  });

  // Scenario 17
  it('refuses access to protected endpoints without a session', async () => {
    const endpoints: Array<[string, 'get' | 'post' | 'patch' | 'delete']> = [
      ['/auth/me', 'get'],
      ['/products', 'get'],
      ['/products', 'post'],
      ['/dashboard/summary', 'get'],
      ['/dashboard/low-stock', 'get'],
      ['/settings', 'get'],
      ['/settings', 'patch'],
    ];

    for (const [path, method] of endpoints) {
      const response = await request(app)[method](path).send({});
      expect(response.status, `${method.toUpperCase()} ${path}`).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('rejects a tampered or malformed token', async () => {
    const tenant = await createTenant();

    // Flipping the signature invalidates the token.
    const tampered = `${tenant.token.slice(0, -4)}AAAA`;

    await request(app).get('/auth/me').set('Cookie', `stockflow_token=${tampered}`).expect(401);
    await request(app).get('/auth/me').set('Cookie', 'stockflow_token=not-a-jwt').expect(401);
    await request(app).get('/auth/me').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('accepts a Bearer token as well as the cookie', async () => {
    const tenant = await createTenant();

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tenant.token}`)
      .expect(200);

    expect(response.body.data.user.organizationId).toBe(tenant.organizationId);
  });
});
