import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from './env';
import { unauthorized } from './errors';

/**
 * JWT payload.
 *
 * `organizationId` is embedded at sign time and is the *only* source of tenant
 * identity used by the API. A client cannot influence it, which is what makes
 * tenant isolation enforceable.
 */
export interface TokenPayload {
  sub: string;
  organizationId: string;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'stockflow',
  } as SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'stockflow' });

    if (typeof decoded === 'string' || !decoded) {
      throw unauthorized('Invalid session token');
    }

    const { sub, organizationId, email } = decoded as Record<string, unknown>;

    if (typeof sub !== 'string' || typeof organizationId !== 'string' || typeof email !== 'string') {
      throw unauthorized('Invalid session token');
    }

    return { sub, organizationId, email };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    // Any other verification failure is reported uniformly so that the response
    // does not reveal why a token was rejected.
    throw unauthorized('Invalid or expired session');
  }
}
