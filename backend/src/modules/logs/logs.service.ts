import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { getDiffDetails, writeActivity } from '../../utils/activityLog';
import { adjustPartQuantity, assertPartsAvailable, diffPartUsage } from '../../utils/partsStock';
import { costFields, partsTotal, priceParts, resolveLaborCost } from '../../utils/logCosts';
import {
  assertMachineInScope,
  assertSparePartsInScope,
  getMachineBranchId,
  type BranchScope,
} from '../../utils/branchScope';
import type { CreateLogInput, UpdateLogInput } from './logs.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

function toApi(log: any) {
  const { parts, ...rest } = log;
  return {
    ...rest,
    partsUsed: parts?.map((p: any) => ({
      partId: p.partId,
      quantity: Number(p.quantity),
      name: p.name,
      unitPrice: p.unitPrice === null || p.unitPrice === undefined ? undefined : Number(p.unitPrice),
    })),
  };
}

function logTypeLabel(type?: string | null): string {
  switch (type) {
    case 'routine':
      return 'Регламентные задачи (ЕО и ТО)';
    case 'diagnostic':
      return 'Диагностика и КИП';
    case 'ppr':
      return 'ППР (Плановый ремонт)';
    case 'emergency':
      return 'Аварийный ремонт';
    case 'repair':
      return 'Ремонт';
    case 'inspection':
      return 'Осмотр / Диагностика';
    default:
      return 'Обслуживание ТОиР';
  }
}

export const logsService = {
  async listForMachine(machineId: string) {
    const rows = await prisma.maintenanceLog.findMany({ where: { machineId }, orderBy: { date: 'desc' }, include: { parts: true } });
    return rows.map(toApi);
  },

  async listAll(scope: BranchScope) {
    const rows = await prisma.maintenanceLog.findMany({ where: scope ? { machine: { branchId: { in: scope } } } : undefined, orderBy: { date: 'desc' }, include: { parts: true } });
    return rows.map(toApi);
  },

  /**
   * Creates the log and records the activity, all in one transaction. A `completed` log
   * (the default - work already happened) consumes stock immediately, same as before this
   * reservation ledger existed. A `planned` log only reserves stock via PartReservation
   * until it's later confirmed with `complete()`.
   */
  async create(input: CreateLogInput, actor: Actor, scope: BranchScope) {
    const { partsUsed, laborCost, cost, ...data } = input;
    const status = input.status ?? 'completed';
    await assertMachineInScope(scope, data.machineId);
    await assertSparePartsInScope(scope, (partsUsed ?? []).map((p) => p.partId));

    const log = await prisma.$transaction(async (tx) => {
      if (partsUsed?.length) {
        await assertPartsAvailable(tx, partsUsed);
      }

      const priced = await priceParts(tx, partsUsed ?? []);
      const partsCost = partsTotal(priced);
      const created = await tx.maintenanceLog.create({
        data: { ...data, status, performedBy: actor.userId, ...costFields(resolveLaborCost({ laborCost, cost }, partsCost), partsCost) },
      });

      if (partsUsed?.length) {
        await tx.maintenanceLogPart.createMany({
          data: priced.map((p) => ({ logId: created.id, partId: p.partId, quantity: p.quantity, name: p.name, unitPrice: p.unitPrice })),
        });
        if (status === 'completed') {
          for (const p of partsUsed) {
            await adjustPartQuantity(tx, p.partId, -p.quantity);
          }
        } else {
          await tx.partReservation.createMany({
            data: partsUsed.map((p) => ({ partId: p.partId, quantity: p.quantity, sourceType: 'maintenance_log', sourceId: created.id })),
          });
        }
      }

      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'log',
        entityId: created.id,
        entityName: logTypeLabel(created.type),
        details:
          status === 'planned'
            ? `Запланирована запись ТОиР (${logTypeLabel(created.type)}), запчасти зарезервированы. Исполнитель: ${created.technicianName || 'Не указан'}`
            : `Создана запись ТОиР (${logTypeLabel(created.type)}). Исполнитель: ${created.technicianName || 'Не указан'}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });

      return tx.maintenanceLog.findUniqueOrThrow({ where: { id: created.id }, include: { parts: true } });
    });

    const api = toApi(log);
    emitEntity('log', 'created', api, await getMachineBranchId(api.machineId));
    emitEntity('sparePart', 'changed', { reason: 'log:created', logId: api.id });
    return api;
  },

  /**
   * Updates the log. A planned log's parts diff only against its reservation (stock
   * untouched); a completed log's parts diff against real stock, same as before. The
   * `status` itself can't be changed here - only `complete()` moves planned -> completed.
   */
  async update(id: string, input: UpdateLogInput, actor: Actor, scope: BranchScope) {
    const original = await prisma.maintenanceLog.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance log');
    await assertMachineInScope(scope, original.machineId).catch(() => {
      throw Errors.notFound('Maintenance log');
    });
    if (input.machineId) await assertMachineInScope(scope, input.machineId);
    await assertSparePartsInScope(scope, (input.partsUsed ?? []).map((p) => p.partId));

    if (input.status && input.status !== original.status) {
      throw Errors.badRequest('Статус записи меняется только через отдельное действие "Выполнено"', 'STATUS_LOCKED');
    }

    const { partsUsed, status: _ignoredStatus, laborCost, cost, ...data } = input;

    const log = await prisma.$transaction(async (tx) => {
      let partsCost = Number(original.partsCost);

      if (partsUsed) {
        const before = original.parts.map((p) => ({ partId: p.partId, quantity: Number(p.quantity), name: p.name }));

        if (original.status === 'planned') {
          await assertPartsAvailable(tx, partsUsed, { sourceType: 'maintenance_log', sourceId: id });
          await tx.partReservation.deleteMany({ where: { sourceType: 'maintenance_log', sourceId: id } });
          if (partsUsed.length) {
            await tx.partReservation.createMany({
              data: partsUsed.map((p) => ({ partId: p.partId, quantity: p.quantity, sourceType: 'maintenance_log', sourceId: id })),
            });
          }
        } else {
          const diffs = diffPartUsage(before, partsUsed);
          for (const [partId, delta] of diffs) {
            if (delta === 0) continue;
            await adjustPartQuantity(tx, partId, -delta);
          }
        }

        // Parts already on the log keep the price they were saved with; newly added ones get today's price.
        const keep = new Map(
          original.parts.filter((p) => p.unitPrice !== null).map((p) => [p.partId, Number(p.unitPrice)] as [string, number]),
        );
        const priced = await priceParts(tx, partsUsed, keep);
        partsCost = partsTotal(priced);
        await tx.maintenanceLogPart.deleteMany({ where: { logId: id } });
        if (priced.length) {
          await tx.maintenanceLogPart.createMany({
            data: priced.map((p) => ({ logId: id, partId: p.partId, quantity: p.quantity, name: p.name, unitPrice: p.unitPrice })),
          });
        }
      }

      const costsChanged = Boolean(partsUsed) || laborCost !== undefined || cost !== undefined;
      const updated = await tx.maintenanceLog.update({
        where: { id },
        data: {
          ...data,
          ...(costsChanged ? costFields(resolveLaborCost({ laborCost, cost }, partsCost, Number(original.laborCost)), partsCost) : {}),
        },
      });

      const diffDetails = getDiffDetails(toApi(original), input as Record<string, unknown>);
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'log',
        entityId: id,
        entityName: logTypeLabel(updated.type),
        details: `Обновлена запись обслуживания (${logTypeLabel(original.type)}). ${diffDetails}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });

      return tx.maintenanceLog.findUniqueOrThrow({ where: { id }, include: { parts: true } });
    });

    const api = toApi(log);
    emitEntity('log', 'updated', api, await getMachineBranchId(api.machineId));
    emitEntity('sparePart', 'changed', { reason: 'log:updated', logId: api.id });
    return api;
  },

  /** Confirms a planned log's work is done: reservation -> real stock consumption, in one transaction. */
  async complete(id: string, actor: Actor, scope: BranchScope) {
    const original = await prisma.maintenanceLog.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance log');
    await assertMachineInScope(scope, original.machineId).catch(() => {
      throw Errors.notFound('Maintenance log');
    });
    if (original.status !== 'planned') {
      throw Errors.conflict('ALREADY_COMPLETED', 'Эта запись уже отмечена как выполненная');
    }

    const log = await prisma.$transaction(async (tx) => {
      await tx.partReservation.deleteMany({ where: { sourceType: 'maintenance_log', sourceId: id } });
      for (const p of original.parts) {
        await adjustPartQuantity(tx, p.partId, -Number(p.quantity));
      }
      // Stock is consumed now, so the parts are priced at today's prices (the planned figure was an estimate).
      const priced = await priceParts(tx, original.parts);
      for (const p of priced) {
        await tx.maintenanceLogPart.update({ where: { logId_partId: { logId: id, partId: p.partId } }, data: { unitPrice: p.unitPrice } });
      }
      const partsCost = partsTotal(priced);
      const updated = await tx.maintenanceLog.update({
        where: { id },
        data: { status: 'completed', ...costFields(Number(original.laborCost), partsCost) },
      });

      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'log',
        entityId: id,
        entityName: logTypeLabel(updated.type),
        details: `Запись обслуживания (${logTypeLabel(original.type)}) отмечена как выполненная, запчасти списаны со склада`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });

      return tx.maintenanceLog.findUniqueOrThrow({ where: { id }, include: { parts: true } });
    });

    const api = toApi(log);
    emitEntity('log', 'updated', api, await getMachineBranchId(api.machineId));
    emitEntity('sparePart', 'changed', { reason: 'log:completed', logId: api.id });
    return api;
  },

  /** Deletes the log. A planned log just releases its reservation; a completed log restores stock, all in one transaction. */
  async remove(id: string, actor: Actor, scope: BranchScope) {
    const original = await prisma.maintenanceLog.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance log');
    await assertMachineInScope(scope, original.machineId).catch(() => {
      throw Errors.notFound('Maintenance log');
    });

    await prisma.$transaction(async (tx) => {
      if (original.status === 'planned') {
        await tx.partReservation.deleteMany({ where: { sourceType: 'maintenance_log', sourceId: id } });
      } else {
        for (const p of original.parts) {
          await adjustPartQuantity(tx, p.partId, Number(p.quantity));
        }
      }
      await tx.maintenanceLog.delete({ where: { id } });

      const typeLabel = logTypeLabel(original.type);
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'log',
        entityId: id,
        entityName: typeLabel,
        details: `Удалена запись обслуживания (${typeLabel}). Работы: "${original.notes || '—'}", Мастер: ${original.technicianName || '—'}, затраты: ${original.cost}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });

    emitEntity('log', 'deleted', { id });
    emitEntity('sparePart', 'changed', { reason: 'log:deleted', logId: id });
  },
};
