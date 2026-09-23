import { z } from 'zod';
import { nullableDate } from '../../utils/zodHelpers';

const logType = z.enum(['routine', 'repair', 'inspection', 'diagnostic', 'ppr', 'emergency']);
const toirTaskType = z.enum(['routine', 'diagnostic', 'ppr', 'emergency']);

const partUsage = z.object({
  partId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  name: z.string().min(1),
});

export const createLogSchema = z.object({
  machineId: z.string().uuid(),
  date: z.coerce.date(),
  technicianName: z.string().optional(),
  type: logType,
  taskType: toirTaskType.optional(),
  notes: z.string().optional(),
  cost: z.coerce.number().min(0).default(0),
  scheduleId: z.string().uuid().optional(),
  nextMaintenanceDate: nullableDate,
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  partsUsed: z.array(partUsage).optional(),
});

export const updateLogSchema = createLogSchema.partial();

export type CreateLogInput = z.infer<typeof createLogSchema>;
export type UpdateLogInput = z.infer<typeof updateLogSchema>;
