import { z } from 'zod';

export const attachmentType = z.enum(['image', 'video', 'pdf', 'document', 'archive', 'link', 'other']);

export const uploadAttachmentSchema = z.object({
  name: z.string().optional(),
  type: attachmentType,
  description: z.string().optional(),
  isMainImage: z.coerce.boolean().optional(),
});

export const addLinkSchema = z.object({
  name: z.string().optional(),
  type: attachmentType,
  url: z.string().url(),
  description: z.string().optional(),
});

export const updateAttachmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isMainImage: z.boolean().optional(),
});

export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;
export type AddLinkInput = z.infer<typeof addLinkSchema>;
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
