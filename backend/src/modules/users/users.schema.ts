import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3),
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: z.string().uuid().optional(),
  branchId: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'blocked']).default('active'),
  notes: z.string().optional(),
});

export const updateUserSchema = createUserSchema.omit({ password: true }).partial();

export const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
