import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';
import {
  assertMachineInScope,
  getSparePartBranchId,
  sparePartScopeWhere,
  type BranchScope,
} from '../../utils/branchScope';
import type { CreateSparePartInput, UpdateSparePartInput } from './spareParts.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

async function findPartInScope(id: string, scope: BranchScope) {
  const part = await prisma.sparePart.findFirst({ where: { id, ...sparePartScopeWhere(scope) } });
  if (!part) throw Errors.notFound('Spare part');
  return part;
}

/** A branch-restricted user may only attach parts to their own branch / its machines. */
async function assertPartTargetInScope(input: { branchId?: string; machineId?: string }, scope: BranchScope) {
  if (!scope) return;
  if (input.branchId && input.branchId !== scope) throw Errors.forbidden('Нельзя добавлять запчасти в другой филиал');
  if (input.machineId) await assertMachineInScope(scope, input.machineId);
}

export const sparePartsService = {
  async list(scope: BranchScope) {
    return prisma.sparePart.findMany({ where: sparePartScopeWhere(scope), orderBy: { name: 'asc' } });
  },

  async create(input: CreateSparePartInput, actor: Actor, scope: BranchScope) {
    await assertPartTargetInScope(input, scope);
    if (scope && !input.branchId) input = { ...input, branchId: scope };
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
    emitEntity('sparePart', 'created', part, await getSparePartBranchId(part));
    return part;
  },

  async update(id: string, input: UpdateSparePartInput, actor: Actor, scope: BranchScope) {
    await findPartInScope(id, scope);
    await assertPartTargetInScope(input, scope);

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
    emitEntity('sparePart', 'updated', part, await getSparePartBranchId(part));
    return part;
  },

  async updateQuantity(id: string, quantity: number, actor: Actor, scope: BranchScope) {
    const original = await findPartInScope(id, scope);

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
    emitEntity('sparePart', 'changed', part, await getSparePartBranchId(part));
    return part;
  },

  async remove(id: string, actor: Actor, scope: BranchScope) {
    const original = await findPartInScope(id, scope);

    // maintenance_log_parts / maintenance_schedule_parts reference the part with ON DELETE RESTRICT,
    // so a used part can't be deleted - say why instead of a bare FOREIGN_KEY_VIOLATION.
    const [logUses, scheduleUses] = await Promise.all([
      prisma.maintenanceLogPart.count({ where: { partId: id } }),
      prisma.maintenanceSchedulePart.count({ where: { partId: id } }),
    ]);
    if (logUses > 0 || scheduleUses > 0) {
      throw Errors.conflict(
        'PART_IN_USE',
        `Нельзя удалить запчасть "${original.name}": она используется в записях ТО (${logUses}) и задачах графика (${scheduleUses})`
      );
    }

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
