import { z } from 'zod';

const permissionMatrixItem = z.object({
  menu: z.boolean(),
  create: z.boolean(),
  view: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
  export: z.boolean(),
});

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  permissions: z.record(permissionMatrixItem),
});

export const updateRoleSchema = createRoleSchema.partial();

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
