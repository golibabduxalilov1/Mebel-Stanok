import { z } from 'zod';
import { nullableDate } from '../../utils/zodHelpers';

const machineStatus = z.enum(['active', 'maintenance', 'repair', 'retired']);

export const createMachineSchema = z.object({
  name: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  inventoryNumber: z.string().optional(),
  category: z.string().optional(),
  branchId: z.string().uuid().optional(),
  status: machineStatus.default('active'),
  purchasePrice: z.coerce.number().min(0).default(0),
  purchaseDate: nullableDate,
  installationDate: nullableDate,
  lastMaintenanceDate: nullableDate,
  nextMaintenanceDate: nullableDate,
  usefulLifeYears: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

export const updateMachineSchema = createMachineSchema.partial();

export const machineIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listMachinesQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  status: machineStatus.optional(),
});

export type CreateMachineInput = z.infer<typeof createMachineSchema>;
export type UpdateMachineInput = z.infer<typeof updateMachineSchema>;
