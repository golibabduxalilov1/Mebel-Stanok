import { z } from 'zod';

export const createTransferSchema = z.object({
  machineId: z.string().uuid(),
  toBranchId: z.string().uuid(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
