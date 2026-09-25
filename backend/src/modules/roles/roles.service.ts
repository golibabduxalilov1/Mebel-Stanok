import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';
import { normalizePermissions } from '../../config/permissions';
import type { CreateRoleInput, UpdateRoleInput } from './roles.schema';

type RoleRecord = Awaited<ReturnType<typeof prisma.role.findMany>>[number];

/** Folds legacy permission rows into the current layout for roles not yet re-saved. */
function withNormalizedPermissions<T extends Pick<RoleRecord, 'permissions'>>(role: T): T {
  return { ...role, permissions: normalizePermissions(role.permissions) };
}

interface Actor {
  userId: string;
  userEmail?: string;
}

export const rolesService = {
  async list() {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    return roles.map(withNormalizedPermissions);
  },

  async create(input: CreateRoleInput, actor: Actor) {
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: { ...input, permissions: normalizePermissions(input.permissions), createdBy: actor.userId },
      });
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
      const data = input.permissions ? { ...input, permissions: normalizePermissions(input.permissions) } : input;
      const updated = await tx.role.update({ where: { id }, data });
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
