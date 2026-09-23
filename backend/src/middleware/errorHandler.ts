import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors';

const UNIQUE_FIELD_CODES: Record<string, string> = {
  serial_number: 'SERIAL_NUMBER_TAKEN',
  username: 'USERNAME_TAKEN',
  email: 'EMAIL_TAKEN',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? [];
      const fields = Array.isArray(target) ? target : [target];
      const field = fields.find((f) => UNIQUE_FIELD_CODES[f]) ?? fields[0] ?? 'field';
      const code = UNIQUE_FIELD_CODES[field] ?? 'DUPLICATE_VALUE';
      res.status(409).json({ error: `${field} already exists`, code });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'Referenced resource does not exist', code: 'FOREIGN_KEY_VIOLATION' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}`, code: 'ROUTE_NOT_FOUND' });
}
