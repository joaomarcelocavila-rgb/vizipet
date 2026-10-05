import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Gera um access token de desenvolvimento para um usuário do seed (use no botão Authorize do Swagger).
 * Uso: npm run dev:token -- tutor@vizipet.test
 */
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Indisponível em produção.');
  const email = process.argv[2];
  if (!email) throw new Error('Informe o e-mail: npm run dev:token -- tutor@vizipet.test');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new Error('Usuário não encontrado. Rode o seed antes.');
    const jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });
    console.log(jwt.sign({ sub: user.id, role: user.role, typ: 'access' }, { expiresIn: '1h' }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
