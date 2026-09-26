import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PricedPart {
  partId: string;
  quantity: number;
  name: string;
  unitPrice: number;
}

/**
 * Attaches a unit price to every used part: parts listed in `keep` (already on the log) keep their
 * stored price so later price changes don't rewrite history; the rest get today's catalog price.
 */
export async function priceParts(
  tx: Tx,
  parts: { partId: string; quantity: unknown; name: string }[],
  keep: Map<string, number> = new Map(),
): Promise<PricedPart[]> {
  const missing = [...new Set(parts.filter((p) => !keep.has(p.partId)).map((p) => p.partId))];
  const rows = missing.length
    ? await tx.sparePart.findMany({ where: { id: { in: missing } }, select: { id: true, unitPrice: true } })
    : [];
  const current = new Map(rows.map((r) => [r.id, Number(r.unitPrice ?? 0)]));
  return parts.map((p) => ({
    partId: p.partId,
    quantity: Number(p.quantity),
    name: p.name,
    unitPrice: keep.get(p.partId) ?? current.get(p.partId) ?? 0,
  }));
}

export function partsTotal(parts: PricedPart[]): number {
  return round2(parts.reduce((acc, p) => acc + p.quantity * p.unitPrice, 0));
}

/** `cost` is always the total, so every existing reader of it keeps working. */
export function costFields(laborCost: number, partsCost: number) {
  return { laborCost: round2(laborCost), partsCost: round2(partsCost), cost: round2(laborCost + partsCost) };
}

/**
 * Labor for a log write. Clients that predate the split send only `cost`; their form saved the parts
 * sum there when no labor was entered, so a cost equal to the parts sum means "no labor".
 */
export function resolveLaborCost(input: { laborCost?: number; cost?: number }, partsCost: number, fallback = 0): number {
  if (input.laborCost !== undefined) return input.laborCost;
  if (input.cost !== undefined) return partsCost > 0 && Math.abs(input.cost - partsCost) < 0.01 ? 0 : input.cost;
  return fallback;
}
