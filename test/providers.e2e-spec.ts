import { TestContext, auth, createSpecies, createTestApp, createUser, iso, resetDatabase } from './helpers';

describe('Prestadores, serviços e disponibilidade', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => resetDatabase(ctx.prisma));

  let nextCrmv = 4321;

  async function professionalWithClinic() {
    const crmvNumber = String(nextCrmv++);
    const user = await createUser(ctx.prisma, 'PROFESSIONAL');
    const profile = await ctx
      .http()
      .post('/api/v1/professionals/me')
      .set(auth(user))
      .send({
        displayName: 'Dr. Pedro',
        crmvNumber,
        crmvState: 'pe',
        city: 'Recife',
        neighborhood: 'Graças',
        specialty: 'Clínica',
      })
      .expect(201);
    const clinic = await ctx
      .http()
      .post('/api/v1/clinics')
      .set(auth(user))
      .send({ name: 'Vet Graças', addressLine: 'Rua B, 20', neighborhood: 'Graças', city: 'Recife', state: 'PE' })
      .expect(201);
    return { user, professional: profile.body.data, clinic: clinic.body.data };
  }

  describe('P1 clínicas e profissionais', () => {
    it('cadastra perfil PENDING com UF normalizada e vincula a clínica criada', async () => {
      const { professional, clinic } = await professionalWithClinic();
      expect(professional.verificationStatus).toBe('PENDING');
      expect(professional.crmvState).toBe('PE');
      expect(clinic.verificationStatus).toBe('PENDING');
      const link = await ctx.prisma.clinicProfessional.findMany({ where: { clinicId: clinic.id } });
      expect(link).toHaveLength(1);
    });

    it('CRMV duplicado responde 409', async () => {
      await professionalWithClinic();
      const { professional } = await ctx.prisma.clinic
        .findFirstOrThrow({ include: { professionals: { include: { professional: true } } } })
        .then((c) => c.professionals[0]);
      const other = await createUser(ctx.prisma, 'PROFESSIONAL');
      const res = await ctx
        .http()
        .post('/api/v1/professionals/me')
        .set(auth(other))
        .send({ displayName: 'Outro', crmvNumber: professional.crmvNumber, crmvState: 'PE' })
        .expect(409);
      expect(res.body.code).toBe('CRMV_ALREADY_REGISTERED');
    });

    it('profissional não altera clínica de outro profissional', async () => {
      const { clinic } = await professionalWithClinic();
      const intruder = await createUser(ctx.prisma, 'PROFESSIONAL');
      await ctx
        .http()
        .patch(`/api/v1/clinics/${clinic.id}`)
        .set(auth(intruder))
        .send({ phone: '81999999999' })
        .expect(404);
    });

    it('alterar CRMV de perfil aprovado devolve o perfil para revisão', async () => {
      const { user, professional } = await professionalWithClinic();
      await ctx.prisma.professional.update({
        where: { id: professional.id },
        data: { verificationStatus: 'APPROVED' },
      });

      const bio = await ctx
        .http()
        .patch('/api/v1/professionals/me')
        .set(auth(user))
        .send({ bio: 'Nova bio' })
        .expect(200);
      expect(bio.body.data.verificationStatus).toBe('APPROVED');

      const crmv = await ctx
        .http()
        .patch('/api/v1/professionals/me')
        .set(auth(user))
        .send({ crmvNumber: '9999' })
        .expect(200);
      expect(crmv.body.data.verificationStatus).toBe('PENDING');
    });
  });

  describe('P2 serviços e espécies', () => {
    it('cria serviço presencial e remoto, com preço opcional', async () => {
      const { user } = await professionalWithClinic();
      const { dog } = await createSpecies(ctx.prisma);
      const inPerson = await ctx
        .http()
        .post('/api/v1/services')
        .set(auth(user))
        .send({ name: 'Consulta', modality: 'IN_PERSON', durationMinutes: 30, priceCents: 12000, speciesIds: [dog.id] })
        .expect(201);
      expect(inPerson.body.data.professionalIds).toHaveLength(1);

      const remote = await ctx
        .http()
        .post('/api/v1/services')
        .set(auth(user))
        .send({ name: 'Teleorientação', modality: 'REMOTE', durationMinutes: 20, speciesIds: [dog.id] })
        .expect(201);
      expect(remote.body.data.priceCents).toBeNull();
    });

    it('recusa profissional sem vínculo com o dono do serviço', async () => {
      const { user } = await professionalWithClinic();
      const other = await professionalWithClinic();
      const { dog } = await createSpecies(ctx.prisma);
      const res = await ctx
        .http()
        .post('/api/v1/services')
        .set(auth(user))
        .send({
          name: 'Consulta',
          modality: 'REMOTE',
          durationMinutes: 30,
          speciesIds: [dog.id],
          professionalIds: [other.professional.id],
        })
        .expect(409);
      expect(res.body.code).toBe('PROFESSIONAL_NOT_LINKED');
    });

    it('desativação bloqueia horários livres e preserva consultas futuras', async () => {
      const { user, clinic } = await professionalWithClinic();
      const { dog } = await createSpecies(ctx.prisma);
      const service = (
        await ctx
          .http()
          .post('/api/v1/services')
          .set(auth(user))
          .send({ name: 'Consulta', modality: 'IN_PERSON', durationMinutes: 30, speciesIds: [dog.id] })
          .expect(201)
      ).body.data;
      await ctx
        .http()
        .post('/api/v1/availability')
        .set(auth(user))
        .send({ serviceId: service.id, clinicId: clinic.id, startsAt: iso(48), endsAt: iso(48.5) })
        .expect(201);

      const res = await ctx.http().delete(`/api/v1/services/${service.id}`).set(auth(user)).expect(200);
      expect(res.body.data).toMatchObject({ active: false, blockedSlots: 1, futureAppointments: 0 });

      const blocked = await ctx
        .http()
        .post('/api/v1/availability')
        .set(auth(user))
        .send({ serviceId: service.id, clinicId: clinic.id, startsAt: iso(50), endsAt: iso(50.5) })
        .expect(409);
      expect(blocked.body.code).toBe('SERVICE_NOT_AVAILABLE');
    });
  });

  describe('P3 disponibilidade', () => {
    async function withService() {
      const base = await professionalWithClinic();
      const { dog } = await createSpecies(ctx.prisma);
      const service = (
        await ctx
          .http()
          .post('/api/v1/services')
          .set(auth(base.user))
          .send({ name: 'Consulta', modality: 'IN_PERSON', durationMinutes: 30, speciesIds: [dog.id] })
          .expect(201)
      ).body.data;
      return { ...base, service };
    }

    it('cria horário válido convertendo o fuso para UTC', async () => {
      const { user, service, clinic } = await withService();
      const day = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
      const res = await ctx
        .http()
        .post('/api/v1/availability')
        .set(auth(user))
        .send({
          serviceId: service.id,
          clinicId: clinic.id,
          startsAt: `${day}T09:00:00-03:00`,
          endsAt: `${day}T09:30:00-03:00`,
        })
        .expect(201);
      expect(res.body.data.startsAt).toBe(`${day}T12:00:00.000Z`);
      expect(res.body.data.status).toBe('AVAILABLE');
    });

    it('recusa data passada, início depois do término e data sem fuso', async () => {
      const { user, service, clinic } = await withService();
      const past = await ctx
        .http()
        .post('/api/v1/availability')
        .set(auth(user))
        .send({ serviceId: service.id, clinicId: clinic.id, startsAt: iso(-2), endsAt: iso(-1.5) })
        .expect(400);
      expect(past.body.code).toBe('SLOT_IN_PAST');

      const inverted = await ctx
        .http()
        .post('/api/v1/availability')
        .set(auth(user))
        .send({ serviceId: service.id, clinicId: clinic.id, startsAt: iso(5), endsAt: iso(4) })
        .expect(400);
      expect(inverted.body.code).toBe('INVALID_RANGE');

      await ctx
        .http()
        .post('/api/v1/availability')
        .set(auth(user))
        .send({
          serviceId: service.id,
          clinicId: clinic.id,
          startsAt: '2030-01-01T09:00:00',
          endsAt: '2030-01-01T09:30:00',
        })
        .expect(400);
    });

    it('recusa sobreposição total e parcial', async () => {
      const { user, service, clinic } = await withService();
      await ctx
        .http()
        .post('/api/v1/availability')
        .set(auth(user))
        .send({ serviceId: service.id, clinicId: clinic.id, startsAt: iso(10), endsAt: iso(11) })
        .expect(201);

      for (const [start, end] of [
        [10, 11],
        [10.5, 11.5],
        [9.5, 10.25],
      ]) {
        const res = await ctx
          .http()
          .post('/api/v1/availability')
          .set(auth(user))
          .send({ serviceId: service.id, clinicId: clinic.id, startsAt: iso(start), endsAt: iso(end) })
          .expect(409);
        expect(res.body.code).toBe('SLOT_OVERLAP');
      }
    });

    it('a constraint do banco barra sobreposição mesmo sem passar pelo service', async () => {
      const { professional, service, clinic } = await withService();
      const startsAt = new Date(iso(30));
      const endsAt = new Date(startsAt.getTime() + 3600_000);
      await ctx.prisma.availabilitySlot.create({
        data: { professionalId: professional.id, serviceId: service.id, clinicId: clinic.id, startsAt, endsAt },
      });
      await expect(
        ctx.prisma.availabilitySlot.create({
          data: {
            professionalId: professional.id,
            serviceId: service.id,
            clinicId: clinic.id,
            startsAt: new Date(startsAt.getTime() + 600_000),
            endsAt,
          },
        }),
      ).rejects.toThrow();
    });

    it('gera lote respeitando dias da semana e limite de 90 dias', async () => {
      const { user, service, clinic } = await withService();
      const from = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
      const to = new Date(Date.now() + 8 * 86400_000).toISOString().slice(0, 10);
      const res = await ctx
        .http()
        .post('/api/v1/availability/batch')
        .set(auth(user))
        .send({
          serviceId: service.id,
          clinicId: clinic.id,
          fromDate: from,
          toDate: to,
          weekdays: [1, 3],
          startTime: '08:00',
          endTime: '10:00',
        })
        .expect(201);
      expect(res.body.data.created).toBe(8); // 2 dias x 4 horários de 30 min

      const tooLong = await ctx
        .http()
        .post('/api/v1/availability/batch')
        .set(auth(user))
        .send({
          serviceId: service.id,
          clinicId: clinic.id,
          fromDate: from,
          toDate: new Date(Date.now() + 120 * 86400_000).toISOString().slice(0, 10),
          weekdays: [1],
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(400);
      expect(tooLong.body.code).toBe('BATCH_TOO_LONG');
    });

    it('só bloqueia horário AVAILABLE', async () => {
      const { user, service, clinic } = await withService();
      const slot = (
        await ctx
          .http()
          .post('/api/v1/availability')
          .set(auth(user))
          .send({ serviceId: service.id, clinicId: clinic.id, startsAt: iso(20), endsAt: iso(20.5) })
          .expect(201)
      ).body.data;
      await ctx.prisma.availabilitySlot.update({ where: { id: slot.id }, data: { status: 'BOOKED' } });
      const res = await ctx.http().patch(`/api/v1/availability/${slot.id}/block`).set(auth(user)).expect(409);
      expect(res.body.code).toBe('SLOT_NOT_AVAILABLE');
    });
  });
});
