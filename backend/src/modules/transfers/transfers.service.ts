import { prisma } from '../../lib/prisma';
import { emitEntity } from '../../lib/socket';
import { Errors } from '../../utils/errors';
import { writeActivity } from '../../utils/activityLog';
import type { CreateTransferInput } from './transfers.schema';

interface Actor {
  userId: string;
  userEmail?: string;
}

export const transfersService = {
  async listForMachine(machineId: string) {
    return prisma.transfer.findMany({ where: { machineId }, orderBy: { date: 'desc' } });
  },

  /** Creates the transfer record and moves the machine to its new branch in a single transaction. */
  async create(input: CreateTransferInput, actor: Actor) {
    const { transfer, machine } = await prisma.$transaction(async (tx) => {
      const machineRow = await tx.machine.findUnique({ where: { id: input.machineId } });
      if (!machineRow) throw Errors.notFound('Machine');

      const toBranch = await tx.branch.findUnique({ where: { id: input.toBranchId } });
      if (!toBranch) throw Errors.notFound('Destination branch');

      const transferRow = await tx.transfer.create({
        data: {
          machineId: input.machineId,
          fromBranchId: machineRow.branchId,
          toBranchId: input.toBranchId,
          date: new Date(),
          createdBy: actor.userId,
        },
      });

      const updatedMachine = await tx.machine.update({
        where: { id: input.machineId },
        data: { branchId: input.toBranchId },
      });

      await writeActivity(tx, {
        actionType: 'transfer',
        entityType: 'transfer',
        entityId: transferRow.id,
        entityName: 'Перемещение',
        details: `Перемещение станка "${machineRow.name}" (ID: ${machineRow.id}) в филиал "${toBranch.name}"`,
        userId: actor.userId,
        userEmail: actor.userEmail,
      });

      return { transfer: transferRow, machine: updatedMachine };
    });

    emitEntity('transfer', 'created', transfer);
    emitEntity('machine', 'updated', machine);
    return transfer;
  },
};
