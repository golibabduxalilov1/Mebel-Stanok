import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';
import type { CreateRoleInput, UpdateRoleInput } from './roles.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

export const rolesService = {
  async list() {
    return prisma.role.findMany({ orderBy: { name: 'asc' } });
  },

  async create(input: CreateRoleInput, actor: Actor) {
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({ data: { ...input, createdBy: actor.userId } });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'role',
        entityId: created.id,
        entityName: created.name,
        details: `Создана новая роль доступа: ${created.name}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });
    emitEntity('role', 'created', role);
    return role;
  },

  async update(id: string, input: UpdateRoleInput, actor: Actor) {
    const original = await prisma.role.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Role');

    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id }, data: input });
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'role',
        entityId: id,
        entityName: updated.name,
        details: `Изменены права роли: ${updated.name}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });
    emitEntity('role', 'updated', role);
    return role;
  },

  async remove(id: string, actor: Actor) {
    const original = await prisma.role.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('Role');
    if (original.isSystem) throw Errors.forbidden('System roles cannot be deleted');

    await prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'role',
        entityId: id,
        entityName: original.name,
        details: `Удалена роль: ${original.name}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });
    emitEntity('role', 'deleted', { id });
  },
};
