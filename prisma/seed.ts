import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Dados fictícios para desenvolvimento e homologação. Nunca rode em produção.
 * Os usuários recebem um hash inválido de propósito: o login real é do módulo de
 * autenticação; para testar a API localmente use `npm run dev:token`.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const NO_LOGIN = '!seed-sem-senha';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed bloqueado em produção.');

  const species = await Promise.all(
    [
      ['dog', 'Cachorro'],
      ['cat', 'Gato'],
      ['bird', 'Ave'],
      ['rabbit', 'Coelho'],
    ].map(([slug, name]) => prisma.species.upsert({ where: { slug }, update: { name }, create: { slug, name } })),
  );
  const dog = species.find((s) => s.slug === 'dog')!;
  const cat = species.find((s) => s.slug === 'cat')!;

  const user = (email: string, name: string, role: 'TUTOR' | 'PROFESSIONAL' | 'ADMIN') =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash: NO_LOGIN, phone: '81999990000' },
    });

  const admin = await user('admin@vizipet.test', 'Admin Vizipet', 'ADMIN');
  const tutor = await user('tutor@vizipet.test', 'Marina Tutora', 'TUTOR');
  const vetUser = await user('vet@vizipet.test', 'Dr. Carlos Veterinário', 'PROFESSIONAL');
  await prisma.notificationPreference.upsert({ where: { userId: tutor.id }, update: {}, create: { userId: tutor.id } });

  const pet = await prisma.pet.findFirst({ where: { ownerId: tutor.id, name: 'Luna' } });
  if (!pet) {
    await prisma.pet.create({
      data: {
        ownerId: tutor.id,
        speciesId: dog.id,
        name: 'Luna',
        breed: 'SRD',
        sex: 'FEMALE',
        birthDate: new Date('2021-03-10'),
        weightGrams: 8200,
      },
    });
  }

  const vet = await prisma.professional.upsert({
    where: { crmvNumber_crmvState: { crmvNumber: '12345', crmvState: 'PE' } },
    update: {},
    create: {
      userId: vetUser.id,
      displayName: 'Dr. Carlos Veterinário',
      specialty: 'Clínica geral',
      bio: 'Atendimento clínico de cães e gatos.',
      crmvNumber: '12345',
      crmvState: 'PE',
      city: 'Recife',
      neighborhood: 'Boa Viagem',
      latitude: -8.1195,
      longitude: -34.9003,
      verificationStatus: 'APPROVED',
    },
  });
  await prisma.professional.update({
    where: { id: vet.id },
    data: {
      publicProfile: {
        id: vet.id,
        name: vet.displayName,
        specialty: vet.specialty,
        bio: vet.bio,
        crmv: '12345/PE',
        city: 'Recife',
        neighborhood: 'Boa Viagem',
      },
    },
  });

  let clinic = await prisma.clinic.findFirst({ where: { ownerId: vetUser.id, name: 'Clínica Pata Feliz' } });
  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        ownerId: vetUser.id,
        name: 'Clínica Pata Feliz',
        phone: '8133334444',
        addressLine: 'Av. Conselheiro Aguiar, 1000',
        neighborhood: 'Boa Viagem',
        city: 'Recife',
        state: 'PE',
        latitude: -8.119,
        longitude: -34.9,
        responsibleVet: 'Dr. Carlos Veterinário',
        responsibleCrmv: '12345/PE',
        verificationStatus: 'APPROVED',
      },
    });
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        publicProfile: {
          id: clinic.id,
          name: clinic.name,
          description: null,
          phone: clinic.phone,
          address: 'Av. Conselheiro Aguiar, 1000, Boa Viagem, Recife/PE',
          neighborhood: 'Boa Viagem',
          city: 'Recife',
          state: 'PE',
          latitude: -8.119,
          longitude: -34.9,
        },
      },
    });
    await prisma.clinicProfessional.create({ data: { clinicId: clinic.id, professionalId: vet.id } });
  }

  let service = await prisma.service.findFirst({ where: { ownerId: vetUser.id, name: 'Consulta clínica' } });
  if (!service) {
    service = await prisma.service.create({
      data: {
        ownerId: vetUser.id,
        name: 'Consulta clínica',
        description: 'Avaliação geral de saúde',
        modality: 'IN_PERSON',
        durationMinutes: 30,
        priceCents: 15000,
        species: { create: [{ speciesId: dog.id }, { speciesId: cat.id }] },
        professionals: { create: [{ professionalId: vet.id }] },
      },
    });
  }

  const hasSlots = await prisma.availabilitySlot.count({ where: { professionalId: vet.id } });
  if (hasSlots === 0) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 2);
    base.setUTCHours(12, 0, 0, 0); // 09h em Recife
    const slots = Array.from({ length: 6 }, (_, i) => {
      const startsAt = new Date(base.getTime() + i * 30 * 60000);
      return {
        professionalId: vet.id,
        serviceId: service!.id,
        clinicId: clinic!.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60000),
      };
    });
    await prisma.availabilitySlot.createMany({ data: slots });
  }

  console.log(`Seed concluído. admin=${admin.id} tutor=${tutor.id} vet=${vetUser.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
