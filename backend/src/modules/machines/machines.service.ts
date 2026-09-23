import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { getDiffDetails, writeActivity } from '../../utils/activityLog';
import type { CreateMachineInput, UpdateMachineInput } from './machines.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

async function assertSerialNumberFree(serialNumber: string, excludeId?: string) {
  const existing = await prisma.machine.findFirst({
    where: { serialNumber, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw Errors.conflict('SERIAL_NUMBER_TAKEN', `A machine with serial number "${serialNumber}" already exists`);
  }
}

export const machinesService = {
  async list(filter: { branchId?: string; status?: string }) {
    return prisma.machine.findMany({
      where: {
        branchId: filter.branchId,
        status: filter.status as any,
      },
      orderBy: { updatedAt: 'desc' },
      include: { attachments: true },
    });
  },

  async getById(id: string) {
    const machine = await prisma.machine.findUnique({
      where: { id },
      include: { attachments: true, branch: true },
    });
    if (!machine) throw Errors.notFound('Machine');
    return machine;
  },

  async create(input: CreateMachineInput, actor: Actor) {
    await assertSerialNumberFree(input.serialNumber);

    const machine = await prisma.$transaction(async (tx) => {
      const created = await tx.machine.create({
        data: { ...input, createdBy: actor.userId },
      });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'machine',
        entityId: created.id,
        entityName: created.name,
        details: `Добавлен новый станок: ${created.name} (${created.model})`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });

    emitEntity('machine', 'created', machine);
    return machine;
  },

  async update(id: string, input: UpdateMachineInput, actor: Actor) {
    const original = await prisma.machine.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Machine');

    if (input.serialNumber && input.serialNumber !== original.serialNumber) {
      await assertSerialNumberFree(input.serialNumber, id);
    }

    const machine = await prisma.$transaction(async (tx) => {
      const updated = await tx.machine.update({ where: { id }, data: input });
      const diff = getDiffDetails(original as unknown as Record<string, unknown>, input as Record<string, unknown>);
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'machine',
        entityId: id,
        entityName: updated.name,
        details: `Обновлена информация о станке "${updated.name}". ${diff}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });

    emitEntity('machine', 'updated', machine);
    return machine;
  },

  async remove(id: string, actor: Actor) {
    const original = await prisma.machine.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Machine');

    await prisma.$transaction(async (tx) => {
      await tx.machine.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'machine',
        entityId: id,
        entityName: original.name,
        details: `Удален станок "${original.name}" (Модель: ${original.model || '—'}, С/Н: ${original.serialNumber || '—'}, Категория: ${original.category || '—'})`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });

    emitEntity('machine', 'deleted', { id });
  },
};
