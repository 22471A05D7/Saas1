/**
 * Application error types.
 *
 * Every error thrown deliberately by the service layer is an `ApiError` with an
 * HTTP status, a stable machine-readable `code`, and a message that is safe to
 * show to a client. Anything else that reaches the error middleware is treated
 * as an unexpected failure and reported as a generic 500, so internal details
 * (stack traces, SQL, connection strings) never leak to the caller.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'BAD_REQUEST', message, details);

export const validationError = (message: string, details?: unknown) =>
  new ApiError(422, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'You do not have access to this resource') =>
  new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Resource not found') =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, 'CONFLICT', message, details);

/**
 * Specific conflict codes.
 *
 * These mirror the codes the error middleware derives from a Prisma P2002
 * violation, so a client sees the same `error.code` whether the collision was
 * caught by the service-layer pre-check or by the database index under a race.
 */
export const duplicateSku = () =>
  new ApiError(
    409,
    'DUPLICATE_SKU',
    'A product with this SKU already exists in your organization',
    { sku: 'This SKU is already in use' },
  );

export const emailTaken = () =>
  new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists', {
    email: 'This email is already registered',
  });

export const internal = (message = 'An unexpected error occurred') =>
  new ApiError(500, 'INTERNAL_ERROR', message);
