import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  UPLOADS_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(209715200),
  NODE_ENV: z.string().default('development'),

  // Bootstrap superadmin - the only account seeded by `npm run seed`. It then
  // creates every other user/role itself through the Users & Roles screen.
  SUPERADMIN_USERNAME: z.string().min(3, 'SUPERADMIN_USERNAME is required'),
  SUPERADMIN_EMAIL: z.string().email('SUPERADMIN_EMAIL must be a valid email'),
  SUPERADMIN_PASSWORD: z.string().min(8, 'SUPERADMIN_PASSWORD must be at least 8 characters'),
  SUPERADMIN_FULL_NAME: z.string().default('Суперадминистратор'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
