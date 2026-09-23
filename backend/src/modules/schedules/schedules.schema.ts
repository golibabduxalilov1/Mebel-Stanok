import { z } from 'zod';
import { nullableDate } from '../../utils/zodHelpers';

const toirTaskType = z.enum(['routine', 'diagnostic', 'ppr', 'emergency']);
const priority = z.enum(['low', 'medium', 'high', 'critical']);

const partUsage = z.object({
  partId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  name: z.string().min(1),
});

export const createScheduleSchema = z.object({
  machineId: z.string().uuid(),
  taskName: z.string().min(1),
  intervalDays: z.coerce.number().int().positive(),
  lastPerformed: nullableDate,
  nextDue: nullableDate,
  taskType: toirTaskType.optional(),
  description: z.string().optional(),
  priority: priority.optional(),
  assignedTechnician: z.string().optional(),
  laborCost: z.coerce.number().min(0).optional(),
  estimatedHours: z.coerce.number().min(0).optional(),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  partsUsed: z.array(partUsage).optional(),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
