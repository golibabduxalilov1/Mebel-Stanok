import { prisma } from '../../lib/prisma';
import { emitEntity, emitToBranchUsers } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { getDiffDetails, writeActivity } from '../../utils/activityLog';
import type { BranchScope } from '../../utils/branchScope';
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
  async list(filter: { branchId?: string; status?: string }, scope: BranchScope) {
    if (scope && filter.branchId && filter.branchId !== scope) return [];
    return prisma.machine.findMany({
      where: {
        branchId: scope ?? filter.branchId,
        status: filter.status as any,
      },
      orderBy: { updatedAt: 'desc' },
      include: { attachments: true },
    });
  },

  async getById(id: string, scope: BranchScope) {
    const machine = await prisma.machine.findUnique({
      where: { id },
      include: { attachments: true, branch: true },
    });
    if (!machine || (scope && machine.branchId !== scope)) throw Errors.notFound('Machine');
    return machine;
  },

  async create(input: CreateMachineInput, actor: Actor, scope: BranchScope) {
    if (scope) {
      if (input.branchId && input.branchId !== scope) throw Errors.forbidden('Нельзя добавлять оборудование в другой филиал');
      input = { ...input, branchId: scope };
    }
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

    emitEntity('machine', 'created', machine, machine.branchId);
    return machine;
  },

  async update(id: string, input: UpdateMachineInput, actor: Actor, scope: BranchScope) {
    const original = await prisma.machine.findUnique({ where: { id } });
    if (!original || (scope && original.branchId !== scope)) throw Errors.notFound('Machine');
    if (scope && input.branchId && input.branchId !== scope) {
      throw Errors.forbidden('Нельзя переносить оборудование в другой филиал');
    }

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

    if (original.branchId !== machine.branchId) {
      emitToBranchUsers(original.branchId, 'machine:deleted', { id });
    }
    emitEntity('machine', 'updated', machine, machine.branchId);
    return machine;
  },

  async remove(id: string, actor: Actor, scope: BranchScope) {
    const original = await prisma.machine.findUnique({ where: { id } });
    if (!original || (scope && original.branchId !== scope)) throw Errors.notFound('Machine');

    await prisma.$transaction(async (tx) => {
      await tx.machine.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'machine',
        entityId: id,
        entityName: original.name,
        details: `Удален станок "${original.name}" (Модель: ${original.model || '—'}, С/Н: ${original.serialNumber || '—'})`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });

    emitEntity('machine', 'deleted', { id });
  },
};
