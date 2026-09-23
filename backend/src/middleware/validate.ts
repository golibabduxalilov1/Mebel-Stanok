import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { Errors } from '../utils/errors';

type Source = 'body' | 'query' | 'params';

/** Parses req[source] with a zod schema, replacing it with the parsed (coerced) value. */
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || source}: ${issue.message}`)
        .join('; ');
      return next(Errors.badRequest(message, 'VALIDATION_ERROR'));
    }
    (req as any)[source] = result.data;
    next();
  };
}
