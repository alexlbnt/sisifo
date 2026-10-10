import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

let client: PrismaClient | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Cliente único por instância da função (a Vercel reaproveita instâncias).
 * Neon usa o driver serverless (WebSocket nativo do Node); qualquer outro
 * Postgres (ex.: local, para desenvolvimento) usa o driver `pg`.
 */
export function getDb(): PrismaClient {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não configurada.');

  const isNeon = new URL(connectionString).hostname.endsWith('.neon.tech');
  const adapter = isNeon ? new PrismaNeon({ connectionString }) : new PrismaPg({ connectionString });
  client = new PrismaClient({ adapter });
  return client;
}
