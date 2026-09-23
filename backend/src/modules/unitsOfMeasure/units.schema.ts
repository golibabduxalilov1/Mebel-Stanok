import { z } from 'zod';

export const createUnitSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export const updateUnitSchema = createUnitSchema;

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
