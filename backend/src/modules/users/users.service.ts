import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
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
  branchId: true,
  position: true,
  phone: true,
  status: true,
  notes: true,
  lastLogin: true,
  createdAt: true,
  createdBy: true,
} as const;

export const usersService = {
  async list() {
    return prisma.user.findMany({ select: safeSelect, orderBy: { fullName: 'asc' } });
  },

  async create(input: CreateUserInput, actor: Actor) {
    const { password, ...rest } = input;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { ...rest, passwordHash, createdBy: actor.userId },
        select: safeSelect,
      });
      await writeActivity(tx, {
        actionType: 'create',
        entityType: 'user',
        entityId: created.id,
        entityName: created.fullName,
        details: `Создан новый пользователь: ${created.fullName} (${created.username}), роль: ${created.role?.name || 'Без роли'}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return created;
    });

    emitEntity('user', 'created', user);
    return user;
  },

  async update(id: string, input: UpdateUserInput, actor: Actor) {
    const original = await prisma.user.findUnique({ where: { id }, select: safeSelect });
    if (!original) throw Errors.notFound('User');

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: input, select: safeSelect });
      await writeActivity(tx, {
        actionType: 'update',
        entityType: 'user',
        entityId: id,
        entityName: updated.fullName,
        details: `Обновлены данные пользователя: ${updated.fullName}`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
      return updated;
    });

    emitEntity('user', 'updated', user);
    return user;
  },

  async updatePassword(id: string, newPassword: string, actor: Actor) {
    const original = await prisma.user.findUnique({ where: { id } });
    if (!original) throw Errors.notFound('User');

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
