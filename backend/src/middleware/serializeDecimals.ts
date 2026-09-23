import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';

// Prisma's Decimal has its own toJSON() that stringifies it, so a normal JSON.stringify
// replacer never sees the Decimal instance - the string already replaced it by the time
// the replacer runs. Walking the body before it reaches JSON.stringify is the only way
// to turn purchasePrice/quantity/cost/etc. back into real numbers for the frontend.
function toPlain(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

/** Ensures every res.json(...) call in the app sends Decimal fields as numbers, not strings. */
export function serializeDecimals(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(toPlain(body))) as Response['json'];
  next();
}
