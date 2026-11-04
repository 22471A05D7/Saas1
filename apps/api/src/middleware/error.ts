import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/errors';
import { fail } from '../lib/http';
import { isProduction } from '../lib/env';

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response) {
  return fail(res, 404, 'NOT_FOUND', `No route matches ${req.method} ${req.originalUrl}`);
}

/**
 * Maps a Prisma error onto a safe client-facing response.
 *
 * Returns `null` when the error is not a recognised Prisma error, so the caller
 * can fall through to the generic 500 path.
 */
function mapPrismaError(error: unknown): { status: number; code: string; message: string; details?: unknown } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        // Unique constraint violation. The target tells us which one.
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];

        if (fields.some((f) => f.toLowerCase().includes('sku'))) {
          return {
            status: 409,
            code: 'DUPLICATE_SKU',
            message: 'A product with this SKU already exists in your organization',
            details: { sku: 'This SKU is already in use' },
          };
        }

        if (fields.some((f) => f.toLowerCase().includes('email'))) {
          return {
            status: 409,
            code: 'EMAIL_TAKEN',
            message: 'An account with this email already exists',
            details: { email: 'This email is already registered' },
          };
        }

        return { status: 409, code: 'CONFLICT', message: 'That value is already in use' };
      }

      case 'P2003':
        return { status: 409, code: 'FOREIGN_KEY_VIOLATION', message: 'A related record is missing or still in use' };

      case 'P2025':
        return { status: 404, code: 'NOT_FOUND', message: 'The requested record was not found' };

      default:
        return { status: 400, code: 'DATABASE_ERROR', message: 'The request could not be completed' };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, code: 'DATABASE_VALIDATION_ERROR', message: 'The request contained invalid data' };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    // The message would contain the connection string, so it is never forwarded.
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database is currently unavailable. Please try again shortly.',
    };
  }

  return null;
}

/**
 * Centralized exception handler — the single place where an error becomes an
 * HTTP response. Unrecognised errors are logged server-side and reported as a
 * generic 500 so that stack traces and credentials never reach a client.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error);

  if (error instanceof ApiError) {
    return fail(res, error.status, error.code, error.message, error.details);
  }

  const prismaError = mapPrismaError(error);
  if (prismaError) {
    if (prismaError.status >= 500) console.error('[prisma]', error);
    return fail(res, prismaError.status, prismaError.code, prismaError.message, prismaError.details);
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return fail(res, 400, 'MALFORMED_JSON', 'The request body is not valid JSON');
  }

  console.error('[unhandled]', error);

  return fail(
    res,
    500,
    'INTERNAL_ERROR',
    isProduction
      ? 'An unexpected error occurred'
      : `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
  );
}
