import { z } from 'zod';

export const createSparePartSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.coerce.number().min(0).default(0),
  minQuantity: z.coerce.number().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  unit: z.string().optional(),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  branchId: z.string().uuid().optional(),
  machineIds: z.array(z.string().uuid()).optional(),
  isArchived: z.boolean().optional(),
});

export const updateSparePartSchema = createSparePartSchema.partial();

export const updateQuantitySchema = z.object({
  quantity: z.coerce.number().min(0),
});

export type CreateSparePartInput = z.infer<typeof createSparePartSchema>;
export type UpdateSparePartInput = z.infer<typeof updateSparePartSchema>;
