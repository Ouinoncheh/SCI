import { PrismaClient } from '@prisma/client';
const globalDb = globalThis as unknown as { predictDb?: PrismaClient };
export const db = globalDb.predictDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.predictDb = db;
