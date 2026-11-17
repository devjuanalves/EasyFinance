import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'database/prisma/schema.prisma',
  migrations: {
    path: 'database/prisma/migrations',
    seed: 'node database/prisma/seed.js',
  },
  datasource: { url: process.env.DATABASE_URL },
});
