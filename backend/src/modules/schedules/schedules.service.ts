import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { getDiffDetails, writeActivity } from '../../utils/activityLog';
import { adjustPartQuantity, assertPartsAvailable } from '../../utils/partsStock';
import { costFields, partsTotal, priceParts } from '../../utils/logCosts';
import {
  assertMachineInScope,
  assertSparePartsInScope,
  getMachineBranchId,
  type BranchScope,
} from '../../utils/branchScope';
import type { CreateScheduleInput, UpdateScheduleInput } from './schedules.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

function toApi(schedule: any) {
  const { parts, ...rest } = schedule;
  return {
    ...rest,
    partsUsed: parts?.map((p: any) => ({
      partId: p.partId,
      quantity: Number(p.quantity),
      name: p.name,
      // Present on log parts (price at save time); schedule parts have none.
      ...(p.unitPrice !== null && p.unitPrice !== undefined ? { unitPrice: Number(p.unitPrice) } : {}),
    })),
  };
}

function logTypeForTask(taskType?: string | null): 'routine' | 'repair' | 'inspection' {
  if (taskType === 'ppr') return 'repair';
  if (taskType === 'diagnostic') return 'inspection';
  return 'routine';
}

export const schedulesService = {
  async listForMachine(machineId: string) {
    const rows = await prisma.maintenanceSchedule.findMany({ where: { machineId }, include: { parts: true } });
    return rows.map(toApi);
  },

  async listAll(scope: BranchScope) {
    const rows = await prisma.maintenanceSchedule.findMany({ where: scope ? { machine: { branchId: { in: scope } } } : undefined, include: { parts: true } });
    return rows.map(toApi);
  },

  /** Creates the schedule and reserves its parts (stock itself is untouched until execute()), all in one transaction. */
  async create(input: CreateScheduleInput, actor: Actor, scope: BranchScope) {
    const { partsUsed, ...data } = input;
    await assertMachineInScope(scope, data.machineId);
    await assertSparePartsInScope(scope, (partsUsed ?? []).map((p) => p.partId));
    const schedule = await prisma.$transaction(async (tx) => {
      if (partsUsed?.length) await assertPartsAvailable(tx, partsUsed);

      const created = await tx.maintenanceSchedule.create({ data: { ...data, createdBy: actor.userId } });
      if (partsUsed?.length) {
        await tx.maintenanceSchedulePart.createMany({
          data: partsUsed.map((p) => ({ scheduleId: created.id, partId: p.partId, quantity: p.quantity, name: p.name })),
        });
        await tx.partReservation.createMany({
          data: partsUsed.map((p) => ({ partId: p.partId, quantity: p.quantity, sourceType: 'toir_schedule', sourceId: created.id })),
        });
      }
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'schedule',
        entityId: created.id,
        entityName: created.taskName,
        details: `Создана периодическая задача обслуживания: "${created.taskName}" раз в ${created.intervalDays} дн.${partsUsed?.length ? ' Запчасти зарезервированы со склада.' : ''}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return tx.maintenanceSchedule.findUniqueOrThrow({ where: { id: created.id }, include: { parts: true } });
    });
    const api = toApi(schedule);
    emitEntity('schedule', 'created', api, await getMachineBranchId(api.machineId));
    if (api.partsUsed?.length) emitEntity('sparePart', 'changed', { reason: 'schedule:created', scheduleId: api.id });
    return api;
  },

  async update(id: string, input: UpdateScheduleInput, actor: Actor, scope: BranchScope) {
    const original = await prisma.maintenanceSchedule.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance schedule');
    await assertMachineInScope(scope, original.machineId).catch(() => {
      throw Errors.notFound('Maintenance schedule');
    });
    if (input.machineId) await assertMachineInScope(scope, input.machineId);
    await assertSparePartsInScope(scope, (input.partsUsed ?? []).map((p) => p.partId));

    const { partsUsed, ...data } = input;
    const schedule = await prisma.$transaction(async (tx) => {
      if (partsUsed) {
        if (partsUsed.length) await assertPartsAvailable(tx, partsUsed, { sourceType: 'toir_schedule', sourceId: id });
        await tx.partReservation.deleteMany({ where: { sourceType: 'toir_schedule', sourceId: id } });
        if (partsUsed.length) {
          await tx.partReservation.createMany({
            data: partsUsed.map((p) => ({ partId: p.partId, quantity: p.quantity, sourceType: 'toir_schedule', sourceId: id })),
          });
        }
      }

      const updated = await tx.maintenanceSchedule.update({ where: { id }, data });
      if (partsUsed) {
        await tx.maintenanceSchedulePart.deleteMany({ where: { scheduleId: id } });
        if (partsUsed.length) {
          await tx.maintenanceSchedulePart.createMany({
            data: partsUsed.map((p) => ({ scheduleId: id, partId: p.partId, quantity: p.quantity, name: p.name })),
          });
        }
      }
      const diff = getDiffDetails(toApi(original), input as Record<string, unknown>);
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'schedule',
        entityId: id,
        entityName: updated.taskName,
        details: `Обновлена периодическая задача обслуживания "${updated.taskName}". ${diff}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return tx.maintenanceSchedule.findUniqueOrThrow({ where: { id }, include: { parts: true } });
    });
    const api = toApi(schedule);
    emitEntity('schedule', 'updated', api, await getMachineBranchId(api.machineId));
    if (partsUsed) emitEntity('sparePart', 'changed', { reason: 'schedule:updated', scheduleId: api.id });
    return api;
  },

  /** Deletes the schedule and releases its reservation (stock was never touched by an unexecuted schedule). */
  async remove(id: string, actor: Actor, scope: BranchScope) {
    const original = await prisma.maintenanceSchedule.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Maintenance schedule');
    await assertMachineInScope(scope, original.machineId).catch(() => {
      throw Errors.notFound('Maintenance schedule');
    });

    const hadReservations = await prisma.partReservation.count({ where: { sourceType: 'toir_schedule', sourceId: id } });

    await prisma.$transaction(async (tx) => {
      await tx.partReservation.deleteMany({ where: { sourceType: 'toir_schedule', sourceId: id } });
      await tx.maintenanceSchedule.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'schedule',
        entityId: id,
        entityName: original.taskName,
        details: `Удалена периодическая задача обслуживания "${original.taskName}" (Интервал выполнения: ${original.intervalDays} дн.)`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });
    emitEntity('schedule', 'deleted', { id });
    if (hadReservations > 0) emitEntity('sparePart', 'changed', { reason: 'schedule:deleted', scheduleId: id });
  },

  /**
   * Marks a schedule as done: its reservation is converted into real stock consumption and a
   * historical MaintenanceLog is written directly (bypassing logsService so it can't deduct a
   * second time), all in one transaction. `recurring` keeps the schedule around with its dates
   * advanced instead of deleting it (the next occurrence's parts must be re-added by editing it).
   */
  async execute(id: string, options: { recurring?: boolean }, actor: Actor, scope: BranchScope) {
    const original = await prisma.maintenanceSchedule.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance schedule');
    await assertMachineInScope(scope, original.machineId).catch(() => {
      throw Errors.notFound('Maintenance schedule');
    });

    const recurring = Boolean(options.recurring);
    const now = new Date();
    const nextDue = new Date(now.getTime() + original.intervalDays * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      for (const p of original.parts) {
        await adjustPartQuantity(tx, p.partId, -Number(p.quantity));
      }
      await tx.partReservation.deleteMany({ where: { sourceType: 'toir_schedule', sourceId: id } });

      const priced = await priceParts(tx, original.parts);
      const createdLog = await tx.maintenanceLog.create({
        data: {
          machineId: original.machineId,
          date: now,
          technicianName: original.assignedTechnician || 'Дежурный специалист',
          type: logTypeForTask(original.taskType),
          status: 'completed',
          taskType: original.taskType ?? 'routine',
          notes: `Выполнено ТО: ${original.taskName}${original.description ? ` (${original.description})` : ''}`,
          ...costFields(Number(original.laborCost ?? 0), partsTotal(priced)),
          performedBy: actor.userId,
          scheduleId: original.id,
          nextMaintenanceDate: recurring ? nextDue : null,
          imageUrl: original.imageUrl,
          imageUrls: original.imageUrls,
        },
      });
      if (original.parts.length) {
        await tx.maintenanceLogPart.createMany({
          data: priced.map((p) => ({ logId: createdLog.id, partId: p.partId, quantity: p.quantity, name: p.name, unitPrice: p.unitPrice })),
        });
      }

      let updatedSchedule = null;
      if (recurring) {
        updatedSchedule = await tx.maintenanceSchedule.update({
          where: { id },
          data: { lastPerformed: now, nextDue },
          include: { parts: true },
        });
      } else {
        await tx.maintenanceSchedule.delete({ where: { id } });
      }

      await tx.machine.update({
        where: { id: original.machineId },
        data: {
          lastMaintenanceDate: now,
          nextMaintenanceDate: recurring ? nextDue : null,
          status: 'active',
        },
      });

      await writeActivity(tx, {
        actionType: recurring ? 'update' : 'delete',
        entityType: 'schedule',
        entityId: id,
        entityName: original.taskName,
        details: `Выполнена задача ТОиР "${original.taskName}"${original.parts.length ? ', запчасти списаны со склада' : ''}${recurring ? `, следующий срок: ${nextDue.toISOString().split('T')[0]}` : ''}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });

      const fullLog = await tx.maintenanceLog.findUniqueOrThrow({ where: { id: createdLog.id }, include: { parts: true } });
      return { log: fullLog, schedule: updatedSchedule };
    });

    const logApi = toApi(result.log);
    const branchId = await getMachineBranchId(original.machineId);
    emitEntity('log', 'created', logApi, branchId);
    if (result.schedule) {
      emitEntity('schedule', 'updated', toApi(result.schedule), branchId);
    } else {
      emitEntity('schedule', 'deleted', { id });
    }
    emitEntity('sparePart', 'changed', { reason: 'schedule:executed', scheduleId: id });
    return { log: logApi, schedule: result.schedule ? toApi(result.schedule) : null };
  },
};
