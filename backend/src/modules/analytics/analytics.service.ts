import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sparePartScopeWhere, type BranchScope } from '../../utils/branchScope';
import type { AttachmentsSummaryQuery, ReservationsQuery, TransfersQuery, UsersActivityQuery } from './analytics.schema';

/**
 * Branches a query may read: the requested one (if it's within scope), else the whole scope.
 * `false` means the requested branch is outside the scope - callers answer with an empty
 * result, same as machines.list does, rather than confirming the branch exists.
 */
function effectiveBranches(scope: BranchScope, branchId?: string): string[] | null | false {
  if (branchId) return scope && !scope.includes(branchId) ? false : [branchId];
  return scope;
}

const ACTION_TYPES = ['create', 'update', 'delete', 'transfer', 'other'] as const;

export const analyticsService = {
  async transfers(query: TransfersQuery, scope: BranchScope) {
    const branches = effectiveBranches(scope, query.branchId);
    if (branches === false) return [];

    const rows = await prisma.transfer.findMany({
      where: {
        machineId: query.machineId,
        date: { gte: query.from, lte: query.to },
        ...(branches ? { OR: [{ fromBranchId: { in: branches } }, { toBranchId: { in: branches } }] } : {}),
      },
      orderBy: { date: 'desc' },
      include: {
        machine: { select: { name: true, model: true } },
        fromBranch: { select: { name: true } },
        toBranch: { select: { name: true } },
      },
    });

    const userIds = [...new Set(rows.map((r) => r.createdBy).filter((id): id is string => Boolean(id)))];
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, username: true } })
      : [];
    const userNames = new Map(users.map((u) => [u.id, u.fullName || u.username]));

    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      machineId: r.machineId,
      machineName: r.machine.name,
      machineModel: r.machine.model,
      fromBranchId: r.fromBranchId,
      fromBranchName: r.fromBranch?.name ?? null,
      toBranchId: r.toBranchId,
      toBranchName: r.toBranch.name,
      createdBy: r.createdBy,
      createdByName: r.createdBy ? userNames.get(r.createdBy) ?? null : null,
    }));
  },

  async reservations(query: ReservationsQuery, scope: BranchScope) {
    const branches = effectiveBranches(scope, query.branchId);
    if (branches === false) return [];

    const rows = await prisma.partReservation.findMany({
      where: branches ? { part: sparePartScopeWhere(branches) } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { part: { select: { name: true, sku: true, unit: true, unitPrice: true, branchId: true, isArchived: true } } },
    });

    const idsOf = (type: 'toir_schedule' | 'maintenance_log') => [...new Set(rows.filter((r) => r.sourceType === type).map((r) => r.sourceId))];
    const scheduleIds = idsOf('toir_schedule');
    const logIds = idsOf('maintenance_log');
    const [schedules, logs] = await Promise.all([
      scheduleIds.length
        ? prisma.maintenanceSchedule.findMany({
            where: { id: { in: scheduleIds } },
            select: { id: true, taskName: true, nextDue: true, machine: { select: { id: true, name: true, branchId: true } } },
          })
        : [],
      logIds.length
        ? prisma.maintenanceLog.findMany({
            where: { id: { in: logIds } },
            select: { id: true, type: true, date: true, notes: true, machine: { select: { id: true, name: true, branchId: true } } },
          })
        : [],
    ]);
    const scheduleMap = new Map(schedules.map((s) => [s.id, s]));
    const logMap = new Map(logs.map((l) => [l.id, l]));

    return rows.map((r) => {
      const source = r.sourceType === 'toir_schedule' ? scheduleMap.get(r.sourceId) : logMap.get(r.sourceId);
      // A shared part can be reserved by a machine of another branch: keep the row (it affects
      // availability here) but don't reveal which machine/task of the other branch holds it.
      const foreign = Boolean(scope && source && (!source.machine.branchId || !scope.includes(source.machine.branchId)));
      const sourceName = !source
        ? null
        : 'taskName' in source
          ? source.taskName
          : source.notes || source.type;
      const sourceDate = !source ? null : 'nextDue' in source ? source.nextDue : source.date;
      const unitPrice = Number(r.part.unitPrice ?? 0);
      const quantity = Number(r.quantity);
      return {
        id: r.id,
        partId: r.partId,
        partName: r.part.name,
        sku: r.part.sku,
        unit: r.part.unit,
        isArchived: r.part.isArchived,
        quantity,
        unitPrice,
        value: Math.round(quantity * unitPrice * 100) / 100,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        sourceName: foreign ? null : sourceName,
        sourceDate: foreign ? null : sourceDate,
        machineId: foreign ? null : source?.machine.id ?? null,
        machineName: foreign ? null : source?.machine.name ?? null,
        isForeign: foreign,
        createdAt: r.createdAt,
      };
    });
  },

  async usersActivity(query: UsersActivityQuery, scope: BranchScope) {
    const branches = effectiveBranches(scope, query.branchId);
    if (branches === false) {
      return { users: [], byActionType: Object.fromEntries(ACTION_TYPES.map((a) => [a, 0])), byEntityType: {}, daily: [], total: 0, unattributed: 0 };
    }
    const users = await prisma.user.findMany({
      where: branches ? { userBranches: { some: { branchId: { in: branches } } } } : undefined,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        status: true,
        position: true,
        lastLogin: true,
        createdAt: true,
        role: { select: { id: true, name: true, color: true } },
        userBranches: { select: { branchId: true } },
      },
    });
    const userIds = users.map((u) => u.id);

    const where: Prisma.ActivityHistoryWhereInput = {
      timestamp: { gte: query.from, lte: query.to },
      ...(branches ? { userId: { in: userIds } } : {}),
    };

    const conditions: Prisma.Sql[] = [];
    if (query.from) conditions.push(Prisma.sql`"timestamp" >= ${query.from}`);
    if (query.to) conditions.push(Prisma.sql`"timestamp" <= ${query.to}`);
    if (branches) conditions.push(userIds.length ? Prisma.sql`user_id IN (${Prisma.join(userIds)})` : Prisma.sql`FALSE`);
    const whereSql = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const [byUserAction, byEntity, daily] = await Promise.all([
      prisma.activityHistory.groupBy({ by: ['userId', 'actionType'], where, _count: { _all: true } }),
      prisma.activityHistory.groupBy({ by: ['entityType'], where, _count: { _all: true } }),
      prisma.$queryRaw<{ day: string; count: number }[]>(Prisma.sql`
        SELECT to_char(("timestamp" AT TIME ZONE 'UTC') + make_interval(mins => ${query.tzOffset}::int), 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM activity_history
        ${whereSql}
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

    const emptyActions = () => Object.fromEntries(ACTION_TYPES.map((a) => [a, 0])) as Record<(typeof ACTION_TYPES)[number], number>;
    const perUser = new Map<string, Record<(typeof ACTION_TYPES)[number], number>>();
    const byActionType = emptyActions();
    let unattributed = 0;
    const known = new Set(userIds);
    byUserAction.forEach((g) => {
      const count = g._count._all;
      byActionType[g.actionType] += count;
      if (!g.userId || !known.has(g.userId)) {
        unattributed += count;
        return;
      }
      const actions = perUser.get(g.userId) ?? emptyActions();
      actions[g.actionType] += count;
      perUser.set(g.userId, actions);
    });

    return {
      users: users.map((u) => {
        const actions = perUser.get(u.id) ?? emptyActions();
        return {
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          email: u.email,
          status: u.status,
          position: u.position,
          lastLogin: u.lastLogin,
          createdAt: u.createdAt,
          roleId: u.role?.id ?? null,
          roleName: u.role?.name ?? null,
          roleColor: u.role?.color ?? null,
          // Never leak ids of branches outside the viewer's scope.
          branchIds: u.userBranches.map((b) => b.branchId).filter((id) => !scope || scope.includes(id)),
          actions,
          total: Object.values(actions).reduce((a, b) => a + b, 0),
        };
      }),
      byActionType,
      byEntityType: Object.fromEntries(byEntity.map((g) => [g.entityType, g._count._all])),
      daily: daily.map((d) => ({ date: d.day, count: Number(d.count) })),
      total: Object.values(byActionType).reduce((a, b) => a + b, 0),
      unattributed,
    };
  },

  async attachmentsSummary(query: AttachmentsSummaryQuery, scope: BranchScope) {
    const branches = effectiveBranches(scope, query.branchId);
    const empty = { totals: { files: 0, size: 0, machines: 0, machinesWithFiles: 0, machinesWithoutFiles: 0 }, byType: [], machines: [] };
    if (branches === false) return empty;

    const machineWhere: Prisma.MachineWhereInput = branches ? { branchId: { in: branches } } : {};
    const [machines, groups] = await Promise.all([
      prisma.machine.findMany({ where: machineWhere, select: { id: true, name: true, branchId: true, status: true }, orderBy: { name: 'asc' } }),
      prisma.machineAttachment.groupBy({ by: ['machineId', 'type'], where: { machine: machineWhere }, _count: { _all: true }, _sum: { size: true } }),
    ]);

    const perMachine = new Map<string, { files: number; size: number; byType: Record<string, { count: number; size: number }> }>();
    const byType = new Map<string, { count: number; size: number }>();
    groups.forEach((g) => {
      const count = g._count._all;
      const size = g._sum.size ?? 0;
      const entry = perMachine.get(g.machineId) ?? { files: 0, size: 0, byType: {} };
      entry.files += count;
      entry.size += size;
      entry.byType[g.type] = { count, size };
      perMachine.set(g.machineId, entry);
      const t = byType.get(g.type) ?? { count: 0, size: 0 };
      t.count += count;
      t.size += size;
      byType.set(g.type, t);
    });

    const rows = machines.map((m) => ({ machineId: m.id, name: m.name, branchId: m.branchId, status: m.status, ...(perMachine.get(m.id) ?? { files: 0, size: 0, byType: {} }) }));
    const withFiles = rows.filter((r) => r.files > 0).length;
    return {
      totals: {
        files: rows.reduce((a, r) => a + r.files, 0),
        size: rows.reduce((a, r) => a + r.size, 0),
        machines: rows.length,
        machinesWithFiles: withFiles,
        machinesWithoutFiles: rows.length - withFiles,
      },
      byType: [...byType.entries()].map(([type, t]) => ({ type, ...t })).sort((a, b) => b.count - a.count),
      machines: rows.sort((a, b) => b.files - a.files || a.name.localeCompare(b.name)),
    };
  },
};
