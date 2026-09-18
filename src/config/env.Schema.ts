import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  SEAT_HOLD_SECONDS: z.coerce.number().int().positive().default(300),

  PAYMENT_WINDOW_SECONDS: z.coerce.number().int().positive().default(600),

  REDIS_HOST: z.string().min(1).default('localhost'),

  REDIS_PORT: z.coerce.number().int().positive().default(6379),
});
