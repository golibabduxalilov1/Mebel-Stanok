import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { getDiffDetails, writeActivity } from '../../utils/activityLog';
import type { BranchScope } from '../../utils/branchScope';
import type { CreateBranchInput, UpdateBranchInput } from './branches.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

export const branchesService = {
  async list(scope: BranchScope) {
    return prisma.branch.findMany({ where: scope ? { id: { in: scope } } : undefined, orderBy: { name: 'asc' } });
  },

  async create(input: CreateBranchInput, actor: Actor) {
    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({ data: { ...input, createdBy: actor.userId } });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'branch',
        entityId: created.id,
        entityName: created.name,
        details: `Создан филиал: ${created.name}${created.location ? ' (' + created.location + ')' : ''}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });
    emitEntity('branch', 'created', branch, branch.id);
    return branch;
  },

  async update(id: string, input: UpdateBranchInput, actor: Actor) {
    const original = await prisma.branch.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Branch');

    const branch = await prisma.$transaction(async (tx) => {
      const updated = await tx.branch.update({ where: { id }, data: input });
      const diff = getDiffDetails(original as unknown as Record<string, unknown>, input as Record<string, unknown>);
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'branch',
        entityId: id,
        entityName: updated.name,
        details: `Обновлен филиал "${updated.name}". ${diff}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });
    emitEntity('branch', 'updated', branch, branch.id);
    return branch;
  },

  async remove(id: string, actor: Actor) {
    const original = await prisma.branch.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Branch');

    // transfers.to_branch_id references the branch with ON DELETE RESTRICT.
    const transfersTo = await prisma.transfer.count({ where: { toBranchId: id } });
    if (transfersTo > 0) {
      throw Errors.conflict(
        'BRANCH_IN_USE',
        `Нельзя удалить филиал "${original.name}": он указан как филиал назначения в истории перемещений (${transfersTo})`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.branch.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'branch',
        entityId: id,
        entityName: original.name,
        details: `Удален филиал "${original.name}" (${original.location || 'без указания адреса'}, контакты: ${original.contactPerson || '—'})`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });
    emitEntity('branch', 'deleted', { id });
  },
};
