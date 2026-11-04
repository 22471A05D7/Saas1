/**
 * Typed client for the StockFlow API.
 *
 * All requests go to this app's own `/api/*` proxy, so they are same-origin and
 * the httpOnly session cookie is attached automatically.
 */

export interface FieldErrors {
  [field: string]: string;
}

/**
 * An API error carrying the HTTP status, the stable error code, and any
 * per-field messages, so forms can place errors next to the right input.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldErrors;

  constructor(status: number, code: string, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; details?: unknown };
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

function toFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};

  const result: FieldErrors = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

async function request<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<ApiResult<T>> {
  const { query, ...rest } = init;

  const search = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
  }

  const qs = search.toString();
  const url = `/api${path}${qs ? `?${qs}` : ''}`;

  let response: Response;

  try {
    response = await fetch(url, {
      ...rest,
      credentials: 'same-origin',
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...rest.headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error. Please check your connection.');
  }

  // 204 and other empty responses have no JSON body to parse.
  const text = await response.text();
  let payload: Envelope<T> | null = null;

  if (text) {
    try {
      payload = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new ApiError(response.status, 'INVALID_RESPONSE', 'The server returned an unreadable response.');
    }
  }

  if (!response.ok || !payload?.success) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      toFieldErrors(error?.details),
    );
  }

  return { data: payload.data as T, meta: payload.meta };
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | number | undefined>) =>
    request<T>(path, { method: 'GET', query }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
