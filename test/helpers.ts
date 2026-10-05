import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SourceCheck, SourceChecker } from '../src/jobs/source-checker';
import { MailMessage, MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

export class FakeMail extends MailService {
  sent: MailMessage[] = [];
  failNext = 0;

  async send(message: MailMessage) {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('provedor indisponível');
    }
    this.sent.push(message);
  }
}

export class FakeSourceChecker extends SourceChecker {
  results = new Map<string, SourceCheck>();
  async check(url: string) {
    return this.results.get(url) ?? 'VALID';
  }
}

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  mail: FakeMail;
  sources: FakeSourceChecker;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const mail = new FakeMail();
  const sources = new FakeSourceChecker();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(SourceChecker)
    .useValue(sources)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  setupApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), mail, sources, http: () => request(app.getHttpServer()) };
}

export async function resetDatabase(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

const jwt = new JwtService({ secret: 'segredo-de-teste-com-tamanho-suficiente-123' });

export function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role, typ: 'access' }, { expiresIn: '15m' });
}

export const auth = (user: { id: string; role: string }) => ({ Authorization: `Bearer ${tokenFor(user)}` });

export function createUser(
  prisma: PrismaService,
  role: 'TUTOR' | 'PROFESSIONAL' | 'ADMIN' = 'TUTOR',
  status: 'ACTIVE' | 'BLOCKED' | 'DELETION_PENDING' = 'ACTIVE',
) {
  return prisma.user.create({
    data: {
      email: `${randomUUID()}@teste.dev`,
      name: `Usuário ${role.toLowerCase()}`,
      passwordHash: 'x',
      role,
      status,
    },
  });
}

export async function createSpecies(prisma: PrismaService) {
  const [dog, cat] = await Promise.all([
    prisma.species.create({ data: { slug: `dog-${randomUUID().slice(0, 6)}`, name: 'Cachorro' } }),
    prisma.species.create({ data: { slug: `cat-${randomUUID().slice(0, 6)}`, name: 'Gato' } }),
  ]);
  return { dog, cat };
}

let crmv = 1000;

/** Profissional aprovado, com clínica aprovada, serviço presencial e um horário livre amanhã. */
export async function createBookableProvider(
  prisma: PrismaService,
  opts: { speciesIds: string[]; name?: string; city?: string },
) {
  const user = await createUser(prisma, 'PROFESSIONAL');
  const professional = await prisma.professional.create({
    data: {
      userId: user.id,
      displayName: opts.name ?? 'Dra. Ana Lúcia',
      specialty: 'Dermatologia',
      crmvNumber: String(crmv++),
      crmvState: 'PE',
      city: opts.city ?? 'Recife',
      neighborhood: 'Boa Viagem',
      verificationStatus: 'APPROVED',
    },
  });
  await prisma.professional.update({
    where: { id: professional.id },
    data: {
      publicProfile: {
        id: professional.id,
        name: professional.displayName,
        specialty: 'Dermatologia',
        city: professional.city,
      },
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      ownerId: user.id,
      name: 'Clínica Teste',
      addressLine: 'Rua A, 10',
      neighborhood: 'Boa Viagem',
      city: 'Recife',
      state: 'PE',
      phone: '8133334444',
      responsibleVet: 'Dra. Ana',
      responsibleCrmv: '1234/PE',
      verificationStatus: 'APPROVED',
      publicProfile: { name: 'Clínica Teste' },
      professionals: { create: { professionalId: professional.id } },
    },
  });
  const service = await prisma.service.create({
    data: {
      ownerId: user.id,
      name: 'Consulta dermatológica',
      modality: 'IN_PERSON',
      durationMinutes: 30,
      priceCents: 20000,
      species: { create: opts.speciesIds.map((speciesId) => ({ speciesId })) },
      professionals: { create: { professionalId: professional.id } },
    },
  });
  const slot = await createSlot(prisma, professional.id, service.id, clinic.id, 26);
  return { user, professional, clinic, service, slot };
}

export function createSlot(
  prisma: PrismaService,
  professionalId: string,
  serviceId: string,
  clinicId: string | null,
  hoursFromNow: number,
) {
  const startsAt = new Date(Date.now() + hoursFromNow * 3600_000);
  startsAt.setUTCSeconds(0, 0);
  return prisma.availabilitySlot.create({
    data: { professionalId, serviceId, clinicId, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60000) },
  });
}

export function createPet(prisma: PrismaService, ownerId: string, speciesId: string, extra: { deletedAt?: Date } = {}) {
  return prisma.pet.create({ data: { ownerId, speciesId, name: 'Luna', ...extra } });
}

export const iso = (hoursFromNow: number) => {
  const d = new Date(Date.now() + hoursFromNow * 3600_000);
  d.setUTCSeconds(0, 0);
  return d.toISOString();
};
