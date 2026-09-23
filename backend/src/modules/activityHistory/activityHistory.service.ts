import { prisma } from '../../lib/prisma';
import type { ListActivityQuery } from './activityHistory.schema';

export const activityHistoryService = {
  async list(query: ListActivityQuery) {
    return prisma.activityHistory.findMany({
      where: {
        entityType: query.entityType,
        timestamp: {
          gte: query.from,
          lte: query.to,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: query.limit,
    });
  },
};
