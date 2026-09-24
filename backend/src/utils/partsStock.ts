import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Atomically adjusts spare_parts.quantity by `delta` (negative to consume stock,
 * positive to return it), clamped at 0, in a single UPDATE statement so concurrent
 * maintenance-log writes against the same part can't race each other - this is the
 * "must be one DB transaction" requirement from the spec for parts consumption.
 */
export async function adjustPartQuantity(tx: Tx, partId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  await tx.$executeRaw`
    UPDATE spare_parts
    SET quantity = GREATEST(quantity + ${delta}, 0)
    WHERE id = ${partId}
  `;
}

export interface PartUsageInput {
  partId: string;
  quantity: number;
  name: string;
}

/** Computes per-part quantity deltas needed to go from `before` to `after` usage lists. */
export function diffPartUsage(before: PartUsageInput[], after: PartUsageInput[]): Map<string, number> {
  const diffs = new Map<string, number>();
  for (const p of before) diffs.set(p.partId, (diffs.get(p.partId) ?? 0) - p.quantity);
  for (const p of after) diffs.set(p.partId, (diffs.get(p.partId) ?? 0) + p.quantity);
  return diffs;
}
