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
  status: z.enum(['planned', 'completed']).default('completed'),
  taskType: toirTaskType.optional(),
  notes: z.string().optional(),
  /** Labor only; parts cost and the total (`cost`) are computed on the server from the used parts. */
  laborCost: z.coerce.number().min(0).optional(),
  /** Legacy total/labor field from clients that predate laborCost - see resolveLaborCost(). */
  cost: z.coerce.number().min(0).optional(),
  scheduleId: z.string().uuid().optional(),
  nextMaintenanceDate: nullableDate,
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  partsUsed: z.array(partUsage).optional(),
});

export const updateLogSchema = createLogSchema.partial();

export type CreateLogInput = z.infer<typeof createLogSchema>;
export type UpdateLogInput = z.infer<typeof updateLogSchema>;
