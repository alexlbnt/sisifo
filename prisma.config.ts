import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// A Vercel já injeta as variáveis; localmente elas vêm do .env.local.
config({ path: '.env.local', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Migrações usam a conexão direta (sem pooler) quando o Neon fornece uma.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
