import type { Machine, SparePart } from '../types';

/**
 * A part "belongs" to a machine/branch combo when it's bound to that exact machine,
 * or when it's a branch-wide part (no machine binding, or bound to this machine among others)
 * for the branch the machine sits in.
 */
export function partMatchesTarget(part: SparePart, machineId?: string, branchId?: string): boolean {
  const machineIds = part.machineIds ?? [];
  const isForMachine = Boolean(machineIds.length && machineId && machineIds.includes(machineId));
  const isForBranch = Boolean(
    part.branchId && branchId && part.branchId === branchId && (!machineIds.length || (machineId ? machineIds.includes(machineId) : false))
  );
  return isForMachine || isForBranch;
}

/** Sort rank so parts bound to the given machine float to the top (1) over everything else (0). */
export function partMachineRank(part: SparePart, machineId?: string): 0 | 1 {
  return machineId && (part.machineIds ?? []).includes(machineId) ? 1 : 0;
}

export function partBoundMachines(part: SparePart, machines: Machine[]): Machine[] {
  const machineIds = part.machineIds ?? [];
  if (!machineIds.length) return [];
  return machineIds.map((id) => machines.find((m) => m.id === id)).filter((m): m is Machine => Boolean(m));
}
