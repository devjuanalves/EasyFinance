import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/index.js';
import { disposableDatabaseUrl } from './safety.js';
export function disposableClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: disposableDatabaseUrl() }),
  });
}
