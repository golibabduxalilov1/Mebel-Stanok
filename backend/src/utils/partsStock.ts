import type { Prisma, ReservationSourceType } from '@prisma/client';
import { Errors } from './errors';

type Tx = Prisma.TransactionClient;

/**
 * Atomically adjusts spare_parts.quantity by `delta` (negative to consume stock,
 * positive to return it), clamped at 0, in a single UPDATE statement so concurrent
 * maintenance-log writes against the same part can't race each other - this is the
 * "must be one DB transaction" requirement from the spec for parts consumption.
 */
export async function adjustPartQuantity(tx: Tx, partId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  // spare_parts.id is a `text` column (Prisma's plain String @id, no @db.Uuid), but
  // Prisma's query engine auto-detects UUID-shaped string literals in raw queries and
  // binds them with the Postgres `uuid` OID regardless - explicitly casting the
  // parameter back to text is what actually matches it against the text column.
  await tx.$executeRaw`
    UPDATE spare_parts
    SET quantity = GREATEST(quantity + ${delta}, 0)
    WHERE id = ${partId}::text
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

/** Sums currently-held PartReservation quantities per part, for display (e.g. spare-parts list). */
export async function getReservedTotals(tx: Tx, partIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (partIds.length === 0) return totals;
  const rows = await tx.partReservation.groupBy({
    by: ['partId'],
    where: { partId: { in: [...new Set(partIds)] } },
    _sum: { quantity: true },
  });
  for (const row of rows) totals.set(row.partId, Number(row._sum.quantity ?? 0));
  return totals;
}

export interface PartAvailabilityRequest {
  partId: string;
  quantity: number;
  name?: string;
}

/**
 * Row-locks each requested part (in a stable id order, to avoid deadlocking against a
 * concurrent reservation on the same parts) and checks that the requested quantity does
 * not exceed quantity - reservedElsewhere. `exclude` lets an update re-check its own prior
 * reservation without counting it against itself (mirrors the "previouslyAllocated" trick
 * the frontend already used before this reservation ledger existed).
 */
export async function assertPartsAvailable(
  tx: Tx,
  requests: PartAvailabilityRequest[],
  exclude?: { sourceType: ReservationSourceType; sourceId: string }
): Promise<void> {
  const requestedByPart = new Map<string, number>();
  for (const r of requests) requestedByPart.set(r.partId, (requestedByPart.get(r.partId) ?? 0) + r.quantity);
  const partIds = [...requestedByPart.keys()].sort();
  if (partIds.length === 0) return;

  for (const partId of partIds) {
    const rows = await tx.$queryRaw<{ quantity: number; name: string }[]>`
      SELECT quantity, name FROM spare_parts WHERE id = ${partId}::text FOR UPDATE
    `;
    const part = rows[0];
    if (!part) continue;

    const reservedRows = await tx.partReservation.findMany({
      where: {
        partId,
        ...(exclude ? { NOT: { sourceType: exclude.sourceType, sourceId: exclude.sourceId } } : {}),
      },
      select: { quantity: true },
    });
    const reserved = reservedRows.reduce((sum, r) => sum + Number(r.quantity), 0);
    const available = Number(part.quantity) - reserved;
    const requested = requestedByPart.get(partId)!;

    if (requested > available) {
      throw Errors.conflict(
        'INSUFFICIENT_STOCK',
        `Недостаточно на складе: "${part.name}" — доступно ${available}, запрошено ${requested}`
      );
    }
  }
}
