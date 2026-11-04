import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../../lib/env';
import { notFound } from '../../lib/errors';
import { created, ok } from '../../lib/http';
import { tenant } from '../../middleware/auth';
import * as authService from './auth.service';
import type { LoginInput, RegisterInput } from './auth.schemas';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Session cookie settings.
 *
 * `httpOnly` keeps the token out of reach of page JavaScript (so XSS cannot
 * exfiltrate it), `sameSite` blocks cross-site submission, and `secure` is
 * enabled over HTTPS via COOKIE_SECURE.
 */
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

export async function register(req: Request, res: Response) {
  const { user, token } = await authService.register(req.body as RegisterInput);
  res.cookie(env.COOKIE_NAME, token, cookieOptions());
  // The token is also returned so non-browser clients can use a Bearer header.
  return created(res, { user, token });
}

export async function login(req: Request, res: Response) {
  const { user, token } = await authService.login(req.body as LoginInput);
  res.cookie(env.COOKIE_NAME, token, cookieOptions());
  return ok(res, { user, token });
}

export async function logout(_req: Request, res: Response) {
  // `clearCookie` must receive the same attributes used when setting it.
  res.clearCookie(env.COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  return ok(res, { message: 'Signed out successfully' });
}

export async function me(req: Request, res: Response) {
  const { id } = tenant(req);
  const user = await authService.getCurrentUser(id);
  if (!user) throw notFound('Your account no longer exists');
  return ok(res, { user });
}
