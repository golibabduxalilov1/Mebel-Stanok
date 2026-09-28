import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface PricedPart {
  partId: string;
  quantity: number;
  name: string;
  unitPrice: number;
}

interface PartLike {
  partId: string;
  quantity: number | { toNumber(): number };
  name: string;
  unitPrice?: number | { toNumber(): number } | null;
}

function toNum(v: number | { toNumber(): number } | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : v.toNumber();
}

/**
 * Enriches parts with unit prices. Uses `keep` map for snapshot-priced parts (already
 * saved on a log); fetches current spare_parts.unit_price for the rest.
 */
export async function priceParts(
  tx: Tx,
  parts: PartLike[],
  keep?: Map<string, number>,
): Promise<PricedPart[]> {
  if (parts.length === 0) return [];

  const priceMap = new Map<string, number>(keep);
  const needLookup = parts.map((p) => p.partId).filter((id) => !priceMap.has(id));

  if (needLookup.length > 0) {
    const rows = await tx.sparePart.findMany({
      where: { id: { in: [...new Set(needLookup)] } },
      select: { id: true, unitPrice: true },
    });
    for (const row of rows) {
      priceMap.set(row.id, row.unitPrice != null ? Number(row.unitPrice) : 0);
    }
  }

  return parts.map((p) => ({
    partId: p.partId,
    quantity: toNum(p.quantity),
    name: p.name,
    unitPrice: priceMap.get(p.partId) ?? 0,
  }));
}

/** Sums quantity × unitPrice across all priced parts. */
export function partsTotal(priced: PricedPart[]): number {
  return priced.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
}

/** Returns Prisma-ready cost fields: laborCost, partsCost, cost (total). */
export function costFields(
  laborCost: number,
  partsCost: number,
): { laborCost: number; partsCost: number; cost: number } {
  const lc = Math.max(0, laborCost);
  const pc = Math.max(0, partsCost);
  return { laborCost: lc, partsCost: pc, cost: lc + pc };
}

/**
 * Resolves the labor cost from a create/update input.
 * Priority: explicit laborCost > (cost - partsCost) > keep original.
 */
export function resolveLaborCost(
  input: { laborCost?: number | null; cost?: number | null },
  partsCost: number,
  originalLaborCost = 0,
): number {
  if (input.laborCost != null) return Math.max(0, input.laborCost);
  if (input.cost != null) return Math.max(0, input.cost - partsCost);
  return Math.max(0, originalLaborCost);
}
