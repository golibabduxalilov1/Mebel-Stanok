import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { getDiffDetails, writeActivity } from '../../utils/activityLog';
import { adjustPartQuantity, diffPartUsage } from '../../utils/partsStock';
import type { CreateLogInput, UpdateLogInput } from './logs.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

function toApi(log: any) {
  const { parts, ...rest } = log;
  return { ...rest, partsUsed: parts?.map((p: any) => ({ partId: p.partId, quantity: Number(p.quantity), name: p.name })) };
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

  async listAll() {
    const rows = await prisma.maintenanceLog.findMany({ orderBy: { date: 'desc' }, include: { parts: true } });
    return rows.map(toApi);
  },

  /** Creates the log, consumes spare_parts stock, and records the activity - all in one transaction. */
  async create(input: CreateLogInput, actor: Actor) {
    const { partsUsed, ...data } = input;

    const log = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceLog.create({ data: { ...data, performedBy: actor.userId } });

      if (partsUsed?.length) {
        await tx.maintenanceLogPart.createMany({
          data: partsUsed.map((p) => ({ logId: created.id, partId: p.partId, quantity: p.quantity, name: p.name })),
        });
        for (const p of partsUsed) {
          await adjustPartQuantity(tx, p.partId, -p.quantity);
        }
      }

      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'log',
        entityId: created.id,
        entityName: logTypeLabel(created.type),
        details: `Создана запись ТОиР (${logTypeLabel(created.type)}). Исполнитель: ${created.technicianName || 'Не указан'}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });

      return tx.maintenanceLog.findUniqueOrThrow({ where: { id: created.id }, include: { parts: true } });
    });

    const api = toApi(log);
    emitEntity('log', 'created', api);
    emitEntity('sparePart', 'changed', { reason: 'log:created', logId: api.id });
    return api;
  },

  /** Updates the log, applies the delta between old/new parts usage to stock, all in one transaction. */
  async update(id: string, input: UpdateLogInput, actor: Actor) {
    const original = await prisma.maintenanceLog.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance log');

    const { partsUsed, ...data } = input;

    const log = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceLog.update({ where: { id }, data });

      if (partsUsed) {
        const before = original.parts.map((p) => ({ partId: p.partId, quantity: Number(p.quantity), name: p.name }));
        const diffs = diffPartUsage(before, partsUsed);
        for (const [partId, delta] of diffs) {
          if (delta === 0) continue;
          await adjustPartQuantity(tx, partId, -delta);
        }
        await tx.maintenanceLogPart.deleteMany({ where: { logId: id } });
        if (partsUsed.length) {
          await tx.maintenanceLogPart.createMany({
            data: partsUsed.map((p) => ({ logId: id, partId: p.partId, quantity: p.quantity, name: p.name })),
          });
        }
      }

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
    emitEntity('log', 'updated', api);
    emitEntity('sparePart', 'changed', { reason: 'log:updated', logId: api.id });
    return api;
  },

  /** Deletes the log and returns any consumed parts back to stock, all in one transaction. */
  async remove(id: string, actor: Actor) {
    const original = await prisma.maintenanceLog.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance log');

    await prisma.$transaction(async (tx) => {
      for (const p of original.parts) {
        await adjustPartQuantity(tx, p.partId, Number(p.quantity));
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
