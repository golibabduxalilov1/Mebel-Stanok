import { z } from 'zod';

/**
 * Optional nullable date: accepts a parseable date string/Date (set it), `null`
 * (explicitly clear it - the frontend sends `''` for this, which the frontend
 * service layer normalizes to `null` before it reaches the API), or omitted
 * (leave unchanged on update).
 */
export const nullableDate = z.union([z.coerce.date(), z.null()]).optional();
