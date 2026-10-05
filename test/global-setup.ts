import { execSync } from 'node:child_process';

// Aplica as migrations pendentes no banco de teste. Cada suíte limpa as tabelas com TRUNCATE.
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://vizipet:vizipet@localhost:5432/vizipet_test';
  if (!/test/.test(url)) throw new Error('TEST_DATABASE_URL precisa apontar para um banco de teste.');
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
