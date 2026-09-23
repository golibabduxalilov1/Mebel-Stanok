import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';
import type { CreateUnitInput } from './units.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

export const unitsService = {
  async list() {
    return prisma.unitOfMeasure.findMany({ orderBy: { code: 'asc' } });
  },

  async create(input: CreateUnitInput, actor: Actor) {
    const unit = await prisma.$transaction(async (tx) => {
      const created = await tx.unitOfMeasure.create({
        data: { code: input.code.trim(), name: input.name.trim(), createdBy: actor.userId },
      });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'other',
        entityId: created.id,
        entityName: created.name,
        details: `Добавлена новая единица измерения: ${created.code} (${created.name})`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });
    emitEntity('unit', 'created', unit);
    return unit;
  },

  async update(id: string, input: CreateUnitInput, actor: Actor) {
    const original = await prisma.unitOfMeasure.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Unit of measure');
    if (original.isSystem) throw Errors.forbidden('System units of measure cannot be modified');

    const unit = await prisma.$transaction(async (tx) => {
      const updated = await tx.unitOfMeasure.update({
        where: { id },
        data: { code: input.code.trim(), name: input.name.trim() },
      });
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'other',
        entityId: id,
        entityName: updated.name,
        details: `Изменена единица измерения: ${updated.code} (${updated.name})`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });
    emitEntity('unit', 'updated', unit);
    return unit;
  },

  async remove(id: string, actor: Actor) {
    const original = await prisma.unitOfMeasure.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Unit of measure');
    if (original.isSystem) throw Errors.forbidden('System units of measure cannot be deleted');

    await prisma.$transaction(async (tx) => {
      await tx.unitOfMeasure.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'other',
        entityId: id,
        entityName: original.name,
        details: `Удалена единица измерения: ${original.name}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });
    emitEntity('unit', 'deleted', { id });
  },
};
