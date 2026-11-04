import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side proxy to the StockFlow Express API.
 *
 * The browser only ever talks to this Next.js origin, which buys three things:
 *   - the httpOnly session cookie is same-origin, so no CORS or SameSite games;
 *   - `API_BASE_URL` stays a server-only variable, never shipped to the client;
 *   - the API can live on a private network in production.
 *
 * Requests are forwarded verbatim (method, body, cookies) and the upstream
 * `Set-Cookie` headers are relayed back so login and logout work through it.
 */

const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Headers that belong to the hop, not the message, and must not be forwarded. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'host',
  'content-length',
]);

async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const targetUrl = `${API_BASE_URL}/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = !['GET', 'HEAD'].includes(req.method);

  let upstream: Response;

  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    // The API process is down or unreachable — report it as a gateway failure
    // with a message the UI can show, rather than a stack trace.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'API_UNREACHABLE',
          message:
            'Cannot reach the StockFlow API. Make sure the API server is running on ' +
            API_BASE_URL,
        },
      },
      { status: 502 },
    );
  }

  const body = await upstream.arrayBuffer();
  const responseHeaders = new Headers();

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // `set-cookie` is handled below because a response may carry several.
    if (lower === 'set-cookie' || HOP_BY_HOP.has(lower) || lower === 'content-encoding') return;
    responseHeaders.set(key, value);
  });

  // Relay every Set-Cookie so the session cookie lands on this origin.
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    responseHeaders.append('set-cookie', cookie);
  }

  return new NextResponse(body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;

export const dynamic = 'force-dynamic';
