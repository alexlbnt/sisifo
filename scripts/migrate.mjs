// Aplica as migrations do Prisma durante o build da Vercel.
// Fora da Vercel, ou sem banco conectado, não faz nada (o build segue normal).
import { execSync } from 'node:child_process';

if (process.env.VERCEL !== '1') {
  console.log('[migrate] Build local: migrations não rodam aqui. Use `npm run db:migrate`.');
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.log('[migrate] Sem DATABASE_URL: conecte o Neon no projeto da Vercel para ativar a sincronização.');
  process.exit(0);
}

execSync('npx prisma migrate deploy', { stdio: 'inherit' });
