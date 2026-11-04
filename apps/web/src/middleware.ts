import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection at the edge of the frontend.
 *
 * This is a *UX* guard: it checks only whether a session cookie is present, so
 * signed-out visitors are redirected before a protected page renders and
 * signed-in users skip the login screen. It intentionally does not verify the
 * JWT — the signing secret stays on the API, which re-verifies the token on
 * every request. Data access is therefore never gated by this file alone.
 */
const COOKIE_NAME = process.env.COOKIE_NAME ?? 'stockflow_token';

const AUTH_ROUTES = ['/login', '/signup'];
const PROTECTED_PREFIXES = ['/dashboard', '/products', '/settings'];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // Remember where the user was headed so login can return them there.
    url.search = pathname === '/dashboard' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // The proxy under /api must not be intercepted, and static assets are skipped.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
