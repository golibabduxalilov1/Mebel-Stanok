import type { NextFunction, Request, Response } from 'express';
import { Errors } from '../utils/errors';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/** Requires a valid `Authorization: Bearer <token>` access token. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(Errors.unauthorized());
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(Errors.unauthorized('Invalid or expired access token'));
  }
}
