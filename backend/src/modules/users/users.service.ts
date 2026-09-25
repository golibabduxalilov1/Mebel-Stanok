import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { isEnvSuperadmin, SUPERADMIN_LOCKED_FIELDS } from '../../config/superadmin';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';
import type { CreateUserInput, UpdateUserInput } from './users.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

const safeSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  roleId: true,
  role: { select: { id: true, name: true, color: true } },
  userBranches: { select: { branchId: true } },
  position: true,
  phone: true,
  status: true,
  notes: true,
  lastLogin: true,
  createdAt: true,
  createdBy: true,
} as const;

/**
 * Flattens the user_branches join rows into a plain branchIds array for the API response,
 * and flags the .env superadmin so the UI can hide the actions the API would reject.
 */
export function mapUserBranches<T extends { username: string; email: string; userBranches: { branchId: string }[] }>(
  user: T
): Omit<T, 'userBranches'> & { branchIds: string[]; isSuperadmin: boolean } {
  const { userBranches, ...rest } = user;
  return { ...rest, branchIds: userBranches.map((ub) => ub.branchId), isSuperadmin: isEnvSuperadmin(user) };
}

export const usersService = {
  async list() {
    const users = await prisma.user.findMany({ select: safeSelect, orderBy: { fullName: 'asc' } });
    return users.map(mapUserBranches);
  },

  async create(input: CreateUserInput, actor: Actor) {
    const { password, branchIds, ...rest } = input;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { ...rest, passwordHash, createdBy: actor.userId },
        select: safeSelect,
      });
      if (branchIds?.length) {
        await tx.userBranch.createMany({ data: branchIds.map((branchId) => ({ userId: created.id, branchId })) });
      }
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'user',
        entityId: created.id,
        entityName: created.fullName,
        details: `Создан новый пользователь: ${created.fullName} (${created.username}), роль: ${created.role?.name || 'Без роли'}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return branchIds?.length
        ? await tx.user.findUniqueOrThrow({ where: { id: created.id }, select: safeSelect })
        : created;
    });

    const apiUser = mapUserBranches(user);
    emitEntity('user', 'created', apiUser);
    return apiUser;
  },

  async update(id: string, input: UpdateUserInput, actor: Actor) {
    const original = await prisma.user.findUnique({ where: { id }, select: safeSelect });
    if (!original) throw Errors.notFound('User');

    if (isEnvSuperadmin(original)) {
      if (actor.userId !== id) throw Errors.forbidden('Only the superadmin can edit its own account');
      const changed = SUPERADMIN_LOCKED_FIELDS.filter((field) => input[field] !== undefined && input[field] !== original[field]);
      if (changed.length) throw Errors.forbidden(`The superadmin's ${changed.join(', ')} cannot be changed`);
    }

    const { branchIds, ...rest } = input;

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: rest, select: safeSelect });
      if (branchIds !== undefined) {
        await tx.userBranch.deleteMany({ where: { userId: id } });
        if (branchIds.length) {
          await tx.userBranch.createMany({ data: branchIds.map((branchId) => ({ userId: id, branchId })) });
        }
      }
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'user',
        entityId: id,
        entityName: updated.fullName,
        details: `Обновлены данные пользователя: ${updated.fullName}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return branchIds !== undefined
        ? await tx.user.findUniqueOrThrow({ where: { id }, select: safeSelect })
        : updated;
    });

    const apiUser = mapUserBranches(user);
    emitEntity('user', 'updated', apiUser);
    return apiUser;
  },

  async updatePassword(id: string, newPassword: string, actor: Actor) {
    const original = await prisma.user.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('User');

    if (isEnvSuperadmin(original) && actor.userId !== id) {
      throw Errors.forbidden('Only the superadmin can change its own password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'user',
        entityId: id,
        entityName: original.fullName,
        details: `Изменен пароль пользователя: ${original.fullName}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });
  },

  async remove(id: string, actor: Actor) {
    const original = await prisma.user.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('User');

    if (isEnvSuperadmin(original)) {
      throw Errors.forbidden('The superadmin account cannot be deleted');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });
      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'user',
        entityId: id,
        entityName: original.fullName,
        details: `Удален пользователь: ${original.fullName}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });

    emitEntity('user', 'deleted', { id });
  },
};
