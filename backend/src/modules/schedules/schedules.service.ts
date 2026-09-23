import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { getDiffDetails, writeActivity } from '../../utils/activityLog';
import type { CreateScheduleInput, UpdateScheduleInput } from './schedules.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

function toApi(schedule: any) {
  const { parts, ...rest } = schedule;
  return { ...rest, partsUsed: parts?.map((p: any) => ({ partId: p.partId, quantity: Number(p.quantity), name: p.name })) };
}

export const schedulesService = {
  async listForMachine(machineId: string) {
    const rows = await prisma.maintenanceSchedule.findMany({ where: { machineId }, include: { parts: true } });
    return rows.map(toApi);
  },

  async listAll() {
    const rows = await prisma.maintenanceSchedule.findMany({ include: { parts: true } });
    return rows.map(toApi);
  },

  async create(input: CreateScheduleInput, actor: Actor) {
    const { partsUsed, ...data } = input;
    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceSchedule.create({ data: { ...data, createdBy: actor.userId } });
      if (partsUsed?.length) {
        await tx.maintenanceSchedulePart.createMany({
          data: partsUsed.map((p) => ({ scheduleId: created.id, partId: p.partId, quantity: p.quantity, name: p.name })),
        });
      }
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'schedule',
        entityId: created.id,
        entityName: created.taskName,
        details: `Создана периодическая задача обслуживания: "${created.taskName}" раз в ${created.intervalDays} дн.`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return tx.maintenanceSchedule.findUniqueOrThrow({ where: { id: created.id }, include: { parts: true } });
    });
    const api = toApi(schedule);
    emitEntity('schedule', 'created', api);
    return api;
  },

  async update(id: string, input: UpdateScheduleInput, actor: Actor) {
    const original = await prisma.maintenanceSchedule.findUnique({ where: { id }, include: { parts: true } });
    if (!original) throw Errors.notFound('Maintenance schedule');

    const { partsUsed, ...data } = input;
    const schedule = await prisma.$transaction(async (tx) => {
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
    emitEntity('schedule', 'updated', api);
    return api;
  },

  async remove(id: string, actor: Actor) {
    const original = await prisma.maintenanceSchedule.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Maintenance schedule');

    await prisma.$transaction(async (tx) => {
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
  },
};
