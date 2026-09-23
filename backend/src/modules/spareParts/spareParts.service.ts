import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';
import type { CreateSparePartInput, UpdateSparePartInput } from './spareParts.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

export const sparePartsService = {
  async list() {
    return prisma.sparePart.findMany({ orderBy: { name: 'asc' } });
  },

  async create(input: CreateSparePartInput, actor: Actor) {
    const part = await prisma.$transaction(async (tx) => {
      const created = await tx.sparePart.create({ data: { ...input, createdBy: actor.userId } });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'part',
        entityId: created.id,
        entityName: created.name,
        details: `Добавлена деталь: ${created.name} (арт. ${created.sku}), начальное кол-во: ${created.quantity}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });
    emitEntity('sparePart', 'created', part);
    return part;
  },

  async update(id: string, input: UpdateSparePartInput, actor: Actor) {
    const original = await prisma.sparePart.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Spare part');

    const part = await prisma.$transaction(async (tx) => {
      const updated = await tx.sparePart.update({ where: { id }, data: input });
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'part',
        entityId: id,
        entityName: updated.name,
        details: `Обновлена запчасть "${updated.name}": остаток ${updated.quantity}, цена ${updated.unitPrice ?? '—'} ₽`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });
    emitEntity('sparePart', 'updated', part);
    return part;
  },

  async updateQuantity(id: string, quantity: number, actor: Actor) {
    const original = await prisma.sparePart.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Spare part');

    const rounded = Math.round(quantity * 1000) / 1000;
    const part = await prisma.$transaction(async (tx) => {
      const updated = await tx.sparePart.update({ where: { id }, data: { quantity: rounded } });
      const unitStr = original.unit ? ` ${original.unit}` : ' ед.';
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'part',
        entityId: id,
        entityName: original.name,
        details: `Обновлено количество детали "${original.name}": было ${original.quantity}${unitStr}, стало ${rounded}${unitStr}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });
    emitEntity('sparePart', 'changed', part);
    return part;
  },

  async remove(id: string, actor: Actor) {
    const original = await prisma.sparePart.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Spare part');

    await prisma.$transaction(async (tx) => {
      await tx.sparePart.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'part',
        entityId: id,
        entityName: original.name,
        details: `Удалена деталь "${original.name}" (SKU: ${original.sku || '—'}, на складе остававшийся запас: ${original.quantity || 0} шт.)`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });
    emitEntity('sparePart', 'deleted', { id });
  },
};
