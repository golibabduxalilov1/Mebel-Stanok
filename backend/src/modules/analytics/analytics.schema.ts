import { z } from 'zod';

// Query strings arrive as '' for cleared inputs; treat that the same as an omitted param.
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), schema.optional());

const dateRange = {
  from: optional(z.coerce.date()),
  to: optional(z.coerce.date()),
};

const fromBeforeTo = (q: { from?: Date; to?: Date }) => !q.from || !q.to || q.from <= q.to;
const rangeMessage = { message: '"from" must not be later than "to"', path: ['from'] };

export const transfersQuerySchema = z
  .object({
    ...dateRange,
    branchId: optional(z.string().uuid()),
    machineId: optional(z.string().uuid()),
  })
  .refine(fromBeforeTo, rangeMessage);

export const reservationsQuerySchema = z.object({
  branchId: optional(z.string().uuid()),
});

export const usersActivityQuerySchema = z
  .object({
    ...dateRange,
    branchId: optional(z.string().uuid()),
    // Minutes to add to UTC to get the viewer's local day (Tashkent: 300); groups the daily chart.
    tzOffset: z.coerce.number().int().min(-840).max(840).default(0),
  })
  .refine(fromBeforeTo, rangeMessage);

export const attachmentsSummaryQuerySchema = z.object({
  branchId: optional(z.string().uuid()),
});

export type TransfersQuery = z.infer<typeof transfersQuerySchema>;
export type ReservationsQuery = z.infer<typeof reservationsQuerySchema>;
export type UsersActivityQuery = z.infer<typeof usersActivityQuerySchema>;
export type AttachmentsSummaryQuery = z.infer<typeof attachmentsSummaryQuerySchema>;
