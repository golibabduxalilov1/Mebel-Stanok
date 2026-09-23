import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';

interface Actor {
  userId: string;
  userEmail?: string;
}

/**
 * Destructive, admin-only, re-authenticated reset of all operational data.
 * Mirrors the frontend's clearAllData(): machines, spare parts, schedules,
 * transfers, logs and activity history are wiped; users, roles and units of
 * measure are left intact so nobody is locked out of the freshly emptied system.
 */
export const adminService = {
  async clearDatabase(password: string, actor: Actor) {
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    if (!user) throw Errors.unauthorized();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw Errors.invalidCredentials();

    await prisma.$transaction(async (tx) => {
      await tx.maintenanceLogPart.deleteMany();
      await tx.maintenanceSchedulePart.deleteMany();
      await tx.transfer.deleteMany();
      await tx.maintenanceLog.deleteMany();
      await tx.maintenanceSchedule.deleteMany();
      await tx.machineAttachment.deleteMany();
      await tx.sparePart.deleteMany();
      await tx.machine.deleteMany();
      await tx.branch.deleteMany();
      await tx.activityHistory.deleteMany();

      await writeActivity(tx, {
        actionType: 'delete',
        entityType: 'other',
        entityId: 'db-clear',
        entityName: 'База данных',
        details: 'Произведена полная очистка базы данных',
        userId: actor.userId,
        userEmail: actor.userEmail,
      });
    });

    emitEntity('database', 'changed', { reason: 'cleared' });
  },
};
