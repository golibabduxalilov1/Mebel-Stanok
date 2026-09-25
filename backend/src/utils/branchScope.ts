import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { Errors } from './errors';
import type { AccessTokenPayload } from './jwt';

/**
 * The branches a user is restricted to, or null when they may see every branch
 * (administrators, and users with no branch assignments).
 */
export type BranchScope = string[] | null;

export function getBranchScope(user?: AccessTokenPayload): BranchScope {
  if (!user || user.isAdmin) return null;
  const branchIds = user.branchIds;
  if (!branchIds || branchIds.length === 0) return null;
  return branchIds;
}

/** Spare parts belong to a branch directly, or (when branch_id is empty) through their machine. */
export function sparePartScopeWhere(scope: BranchScope): Prisma.SparePartWhereInput {
  if (!scope) return {};
  return { OR: [{ branchId: { in: scope } }, { branchId: null, machine: { branchId: { in: scope } } }] };
}

/** Resolves the branch a spare part effectively belongs to (its own, else its machine's). */
export async function getSparePartBranchId(part: { branchId: string | null; machineId: string | null }): Promise<string | null> {
  if (part.branchId) return part.branchId;
  if (!part.machineId) return null;
  const machine = await prisma.machine.findUnique({ where: { id: part.machineId }, select: { branchId: true } });
  return machine?.branchId ?? null;
}

export async function getMachineBranchId(machineId: string): Promise<string | null> {
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { branchId: true } });
  return machine?.branchId ?? null;
}

/** Throws 404 (not 403, so other branches' ids aren't confirmed to exist) when the machine is outside the scope. */
export async function assertMachineInScope(scope: BranchScope, machineId: string): Promise<void> {
  if (!scope) return;
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { branchId: true } });
  if (!machine || !machine.branchId || !scope.includes(machine.branchId)) throw Errors.notFound('Machine');
}

export async function assertSparePartsInScope(scope: BranchScope, partIds: string[]): Promise<void> {
  if (!scope || partIds.length === 0) return;
  const ids = [...new Set(partIds)];
  const count = await prisma.sparePart.count({ where: { id: { in: ids }, ...sparePartScopeWhere(scope) } });
  if (count !== ids.length) throw Errors.notFound('Spare part');
}

/** Guards routes mounted under /machines/:machineId/... */
export async function requireMachineParamInScope(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    await assertMachineInScope(getBranchScope(req.user), req.params.machineId);
    next();
  } catch (err) {
    next(err);
  }
}

/** Guards /attachments/:id routes - the attachment's machine must be in the user's branch. */
export async function requireAttachmentInScope(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const scope = getBranchScope(req.user);
    if (scope) {
      const attachment = await prisma.machineAttachment.findUnique({
        where: { id: req.params.id },
        select: { machine: { select: { branchId: true } } },
      });
      if (!attachment || !attachment.machine.branchId || !scope.includes(attachment.machine.branchId)) {
        throw Errors.notFound('Attachment');
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
