import type { NextFunction, Request, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { validationError } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

/** Flattens Zod issues into a `{ field: message }` map for the UI. */
function formatIssues(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Validates and *replaces* part of the request with the parsed result, so
 * handlers only ever see coerced, trusted values. Unknown keys are stripped,
 * which is a second line of defence against clients trying to smuggle fields
 * such as `organizationId` into a write.
 */
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        validationError('The submitted data is invalid', formatIssues(result.error)),
      );
    }

    // `req.query`/`req.params` are getter-only in some Express versions.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    return next();
  };
}
