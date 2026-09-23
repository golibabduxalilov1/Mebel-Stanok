import { z } from 'zod';

export const clearDatabaseSchema = z.object({
  password: z.string().min(1, 'Current password is required to confirm this action'),
});

export type ClearDatabaseInput = z.infer<typeof clearDatabaseSchema>;
