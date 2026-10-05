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
        emergency24h: true,
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
          emergency24h: true,
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

  if (!(await prisma.pet.findFirst({ where: { ownerId: tutor.id, name: 'Mingau' } }))) {
    await prisma.pet.create({
      data: {
        ownerId: tutor.id,
        speciesId: cat.id,
        name: 'Mingau',
        breed: 'Siamês',
        sex: 'MALE',
        birthDate: new Date('2023-07-01'),
      },
    });
  }

  await extraProvider({
    email: 'dermato@vizipet.test',
    name: 'Dra. Lúcia Andrade',
    specialty: 'Dermatologia',
    bio: 'Alergias, otites e problemas de pele em cães e gatos.',
    crmv: '23456',
    city: 'Recife',
    neighborhood: 'Graças',
    coords: [-8.0476, -34.8986],
    service: {
      name: 'Consulta dermatológica',
      modality: 'IN_PERSON',
      durationMinutes: 40,
      priceCents: 22000,
      species: [dog.id, cat.id],
    },
    clinic: { name: 'Derma Pet Graças', addressLine: 'Rua das Graças, 210', phone: '8132221111' },
    daysAhead: [1, 3, 4],
  });
  await extraProvider({
    email: 'felinos@vizipet.test',
    name: 'Dr. Rafael Moura',
    specialty: 'Medicina felina',
    bio: 'Atendimento exclusivo para gatos, também por vídeo.',
    crmv: '34567',
    city: 'Olinda',
    neighborhood: 'Casa Caiada',
    coords: [-8.0089, -34.8553],
    service: {
      name: 'Teleorientação felina',
      modality: 'REMOTE',
      durationMinutes: 20,
      priceCents: 9000,
      species: [cat.id],
    },
    daysAhead: [1, 2, 5],
  });
  await emergencyClinics();

  if (!(await prisma.user.findUnique({ where: { email: 'nova@vizipet.test' } }))) {
    const user = await prisma.user.create({
      data: { email: 'nova@vizipet.test', name: 'Dra. Paula Nunes', role: 'PROFESSIONAL', passwordHash: NO_LOGIN },
    });
    const pending = await prisma.professional.create({
      data: {
        userId: user.id,
        displayName: 'Dra. Paula Nunes',
        specialty: 'Ortopedia',
        crmvNumber: '45678',
        crmvState: 'PE',
        city: 'Jaboatão dos Guararapes',
        neighborhood: 'Piedade',
      },
    });
    // Metadados fictícios: os arquivos não existem no storage.
    await prisma.verificationDocument.createMany({
      data: [
        {
          professionalId: pending.id,
          kind: 'CRMV',
          storagePath: 'documents/seed-crmv.pdf',
          originalName: 'crmv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 120000,
        },
        {
          professionalId: pending.id,
          kind: 'IDENTITY',
          storagePath: 'documents/seed-rg.png',
          originalName: 'rg.png',
          mimeType: 'image/png',
          sizeBytes: 340000,
        },
      ],
    });
    await prisma.verificationRequest.create({ data: { target: 'PROFESSIONAL', professionalId: pending.id } });
  }

  if ((await prisma.campaign.count()) === 0) {
    const now = Date.now();
    await prisma.campaign.createMany({
      data: [
        {
          title: 'Vacinação antirrábica gratuita',
          type: 'VACINACAO',
          organization: 'Prefeitura do Recife',
          audience: 'Cães e gatos a partir de 3 meses',
          requirements: 'Levar o animal com coleira ou caixa de transporte',
          location: 'Postos de vacinação em todos os distritos sanitários',
          startsAt: new Date(now - 2 * 86400000),
          endsAt: new Date(now + 20 * 86400000),
          sourceUrl: 'https://www2.recife.pe.gov.br/',
          sourceStatus: 'VALID',
          status: 'PUBLISHED',
          verifiedById: admin.id,
          verifiedAt: new Date(),
        },
        {
          title: 'Castração solidária',
          type: 'CASTRACAO',
          organization: 'Governo de Pernambuco',
          audience: 'Tutores inscritos no CadÚnico',
          requirements: 'Agendamento prévio e jejum de 8 horas',
          location: 'Hospital Veterinário Público',
          startsAt: new Date(now - 86400000),
          endsAt: new Date(now + 40 * 86400000),
          sourceUrl: 'https://www.pe.gov.br/',
          sourceStatus: 'VALID',
          status: 'PUBLISHED',
          verifiedById: admin.id,
          verifiedAt: new Date(),
        },
      ],
    });
  }

  console.log(`Seed concluído. admin=${admin.id} tutor=${tutor.id} vet=${vetUser.id}`);
}

interface ExtraProvider {
  email: string;
  name: string;
  specialty: string;
  bio: string;
  crmv: string;
  city: string;
  neighborhood: string;
  coords: [number, number];
  service: {
    name: string;
    modality: 'IN_PERSON' | 'REMOTE';
    durationMinutes: number;
    priceCents: number;
    species: string[];
  };
  clinic?: { name: string; addressLine: string; phone: string };
  daysAhead: number[];
}

async function extraProvider(p: ExtraProvider) {
  if (await prisma.user.findUnique({ where: { email: p.email } })) return;

  const user = await prisma.user.create({
    data: { email: p.email, name: p.name, role: 'PROFESSIONAL', passwordHash: NO_LOGIN },
  });
  const professional = await prisma.professional.create({
    data: {
      userId: user.id,
      displayName: p.name,
      specialty: p.specialty,
      bio: p.bio,
      crmvNumber: p.crmv,
      crmvState: 'PE',
      city: p.city,
      neighborhood: p.neighborhood,
      latitude: p.coords[0],
      longitude: p.coords[1],
      verificationStatus: 'APPROVED',
    },
  });
  await prisma.professional.update({
    where: { id: professional.id },
    data: {
      publicProfile: {
        id: professional.id,
        name: p.name,
        specialty: p.specialty,
        bio: p.bio,
        crmv: `${p.crmv}/PE`,
        city: p.city,
        neighborhood: p.neighborhood,
      },
    },
  });

  let clinicId: string | null = null;
  if (p.clinic) {
    const clinic = await prisma.clinic.create({
      data: {
        ownerId: user.id,
        name: p.clinic.name,
        phone: p.clinic.phone,
        addressLine: p.clinic.addressLine,
        neighborhood: p.neighborhood,
        city: p.city,
        state: 'PE',
        responsibleVet: p.name,
        responsibleCrmv: `${p.crmv}/PE`,
        verificationStatus: 'APPROVED',
        professionals: { create: { professionalId: professional.id } },
      },
    });
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        publicProfile: {
          id: clinic.id,
          name: clinic.name,
          phone: clinic.phone,
          address: `${clinic.addressLine}, ${p.neighborhood}, ${p.city}/PE`,
          neighborhood: p.neighborhood,
          city: p.city,
          state: 'PE',
        },
      },
    });
    clinicId = clinic.id;
  }

  const service = await prisma.service.create({
    data: {
      ownerId: user.id,
      name: p.service.name,
      modality: p.service.modality,
      durationMinutes: p.service.durationMinutes,
      priceCents: p.service.priceCents,
      species: { create: p.service.species.map((speciesId) => ({ speciesId })) },
      professionals: { create: { professionalId: professional.id } },
    },
  });

  const slots = p.daysAhead.flatMap((days) => {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + days);
    day.setUTCHours(17, 0, 0, 0); // 14h em Recife
    return Array.from({ length: 4 }, (_, i) => {
      const startsAt = new Date(day.getTime() + i * p.service.durationMinutes * 60000);
      return {
        professionalId: professional.id,
        serviceId: service.id,
        clinicId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + p.service.durationMinutes * 60000),
      };
    });
  });
  await prisma.availabilitySlot.createMany({ data: slots });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// Hospitais de plantão sem dono no app: aparecem só na tela de emergência.
async function emergencyClinics() {
  const list = [
    {
      name: 'Hospital Veterinário Plantão 24h',
      phone: '8130305050',
      addressLine: 'Rua Real da Torre, 500',
      neighborhood: 'Madalena',
      city: 'Recife',
      coords: [-8.0526, -34.9089],
    },
    {
      name: 'Pronto Socorro Animal Olinda',
      phone: '8134291010',
      addressLine: 'Av. Getúlio Vargas, 1200',
      neighborhood: 'Bairro Novo',
      city: 'Olinda',
      coords: [-8.0102, -34.8462],
    },
  ] as const;
  for (const c of list) {
    if (await prisma.clinic.findFirst({ where: { name: c.name } })) continue;
    const clinic = await prisma.clinic.create({
      data: {
        name: c.name,
        phone: c.phone,
        addressLine: c.addressLine,
        neighborhood: c.neighborhood,
        city: c.city,
        state: 'PE',
        latitude: c.coords[0],
        longitude: c.coords[1],
        emergency24h: true,
        verificationStatus: 'APPROVED',
      },
    });
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        publicProfile: {
          id: clinic.id,
          name: c.name,
          description: 'Atendimento de urgência 24 horas, inclusive fins de semana e feriados.',
          phone: c.phone,
          address: `${c.addressLine}, ${c.neighborhood}, ${c.city}/PE`,
          neighborhood: c.neighborhood,
          city: c.city,
          state: 'PE',
          latitude: c.coords[0],
          longitude: c.coords[1],
          emergency24h: true,
        },
      },
    });
  }
}
