import { emailTaken, unauthorized } from '../../lib/errors';
import { signToken } from '../../lib/jwt';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import type { LoginInput, RegisterInput } from './auth.schemas';

/** The user shape returned to clients — note the absence of `password`. */
const userSelect = {
  id: true,
  name: true,
  email: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: { id: true, name: true, defaultLowStockThreshold: true },
  },
} as const;

export type PublicUser = Awaited<ReturnType<typeof getCurrentUser>>;

export async function register(input: RegisterInput) {
  // A pre-check gives a friendly field-level message. The unique index on
  // `users.email` remains the actual guarantee and is handled as P2002 by the
  // error middleware if two registrations race.
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw emailTaken();
  }

  const passwordHash = await hashPassword(input.password);

  // The organization and its first user are created together: a tenant with no
  // user, or a user with no tenant, would both be invalid states.
  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.organizationName },
      select: { id: true },
    });

    return tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: passwordHash,
        organizationId: organization.id,
      },
      select: userSelect,
    });
  });

  return { user, token: issueToken(user) };
}

export async function login(input: LoginInput) {
  const record = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...userSelect, password: true },
  });

  // The same message is returned whether the email is unknown or the password
  // is wrong, so the endpoint cannot be used to enumerate registered accounts.
  const invalid = () => unauthorized('Invalid email or password');

  if (!record) {
    // Still spend time hashing to keep the response time of a missing account
    // comparable to that of a wrong password.
    await verifyPassword(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    throw invalid();
  }

  const matches = await verifyPassword(input.password, record.password);
  if (!matches) throw invalid();

  const { password: _password, ...user } = record;

  return { user, token: issueToken(user) };
}

export async function getCurrentUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: userSelect });
}

function issueToken(user: { id: string; email: string; organizationId: string }) {
  return signToken({ sub: user.id, email: user.email, organizationId: user.organizationId });
}
