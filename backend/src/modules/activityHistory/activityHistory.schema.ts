import { z } from 'zod';

export const listActivityQuerySchema = z.object({
  entityType: z.enum(['machine', 'branch', 'part', 'schedule', 'log', 'transfer', 'user', 'role', 'other']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
