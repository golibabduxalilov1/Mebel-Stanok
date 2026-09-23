import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  contactPerson: z.string().optional(),
});

export const updateBranchSchema = createBranchSchema.partial();

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
