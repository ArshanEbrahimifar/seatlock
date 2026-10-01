import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma-ticketing/schema.prisma',

  migrations: {
    path: 'prisma-ticketing/migrations',
  },

  datasource: {
    url: env('TICKETING_DATABASE_URL'),
  },
});
