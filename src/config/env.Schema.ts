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

  KAFKA_BROKERS: z.string().min(1).default('localhost:9092'),

  OUTBOX_LOCK_SECONDS: z.coerce.number().int().positive().default(30),

  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),

  OUTBOX_RETRY_BASE_SECONDS: z.coerce.number().int().positive().default(5),

  OUTBOX_RETRY_MAX_SECONDS: z.coerce.number().int().positive().default(300),

  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),

  TICKETING_DATABASE_URL: z.string().min(1).optional(),
});
