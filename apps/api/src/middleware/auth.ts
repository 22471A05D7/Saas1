import type { NextFunction, Request, Response } from 'express';
import { env } from '../lib/env';
import { unauthorized } from '../lib/errors';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

/**
 * The authenticated principal attached to every protected request.
 *
 * `organizationId` here is the tenant boundary used by every downstream query.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/** Reads the token from the httpOnly cookie, falling back to a Bearer header. */
function extractToken(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[env.COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }

  return null;
}

/**
 * Authentication guard for protected routes.
 *
 * The user is re-read from the database on every request rather than trusted
 * wholesale from the token, so a deleted user — or one moved to another
 * organization — cannot keep acting on a stale `organizationId`.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized('Authentication required');

    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, organizationId: true },
    });

    if (!user) throw unauthorized('Your account no longer exists');

    // Guard against a token minted before the user changed organization.
    if (user.organizationId !== payload.organizationId) {
      throw unauthorized('Your session is no longer valid. Please sign in again.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Returns the tenant scope for the current request.
 *
 * Every data-access call goes through this helper, which means an
 * `organizationId` sent by a client is structurally incapable of reaching a
 * query — the value always comes from the verified session.
 */
export function tenant(req: Request): AuthenticatedUser {
  if (!req.user) {
    // Reaching this would mean a route was mounted without `requireAuth`.
    throw unauthorized('Authentication required');
  }
  return req.user;
}
