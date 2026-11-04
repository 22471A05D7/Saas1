import type { Response } from 'express';

/**
 * Consistent API envelope.
 *
 * Success: { success: true, data: ..., meta?: ... }
 * Failure: { success: false, error: { code, message, details? } }
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>) {
  const body: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(200).json(body);
}

export function created<T>(res: Response, data: T) {
  const body: ApiSuccess<T> = { success: true, data };
  return res.status(201).json(body);
}

export function fail(res: Response, status: number, code: string, message: string, details?: unknown) {
  const body: ApiFailure = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return res.status(status).json(body);
}
