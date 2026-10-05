import { randomUUID } from 'node:crypto';
import {
  TestContext,
  auth,
  createBookableProvider,
  createPet,
  createSpecies,
  createTestApp,
  createUser,
  resetDatabase,
} from './helpers';

describe('G2/G3 agendamentos', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => resetDatabase(ctx.prisma));

  async function scenario() {
    const { dog, cat } = await createSpecies(ctx.prisma);
    const provider = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    const tutor = await createUser(ctx.prisma, 'TUTOR');
    const pet = await createPet(ctx.prisma, tutor.id, dog.id);
    const body = {
      petId: pet.id,
      serviceId: provider.service.id,
      professionalId: provider.professional.id,
      clinicId: provider.clinic.id,
      slotId: provider.slot.id,
    };
    return { dog, cat, provider, tutor, pet, body };
  }

  const book = (user: { id: string; role: string }, body: object, key: string = randomUUID()) =>
    ctx.http().post('/api/v1/appointments').set(auth(user)).set('Idempotency-Key', key).send(body);

  it('confirma, reserva o horário, grava snapshot e evento na Outbox', async () => {
    const { tutor, body, provider } = await scenario();
    const res = await book(tutor, body).expect(201);

    expect(res.body.data.status).toBe('CONFIRMED');
    expect(res.body.data.snapshot).toMatchObject({
      serviceName: 'Consulta dermatológica',
      durationMinutes: 30,
      modality: 'IN_PERSON',
      priceCents: 20000,
      clinicName: 'Clínica Teste',
      clinicAddress: expect.stringContaining('Rua A'),
    });
    expect((await ctx.prisma.availabilitySlot.findUniqueOrThrow({ where: { id: provider.slot.id } })).status).toBe(
      'BOOKED',
    );
    expect(await ctx.prisma.outboxEvent.count({ where: { type: 'APPOINTMENT_CONFIRMED' } })).toBe(1);
  });

  it('exige Idempotency-Key válida', async () => {
    const { tutor, body } = await scenario();
    await ctx.http().post('/api/v1/appointments').set(auth(tutor)).send(body).expect(400);
    await book(tutor, body, 'curta').expect(400);
  });

  it('pet de outro tutor é recusado e o tutorId do corpo é ignorado', async () => {
    const { body, dog } = await scenario();
    const other = await createUser(ctx.prisma, 'TUTOR');
    const res = await book(other, body).expect(403);
    expect(res.body.code).toBe('PET_NOT_OWNED');

    const ownPet = await createPet(ctx.prisma, other.id, dog.id);
    await book(other, { ...body, petId: ownPet.id, tutorId: randomUUID() }).expect(400);
  });

  it('pet removido não aceita novo agendamento', async () => {
    const { tutor, body, pet } = await scenario();
    await ctx.prisma.pet.update({ where: { id: pet.id }, data: { deletedAt: new Date() } });
    expect((await book(tutor, body).expect(404)).body.code).toBe('PET_NOT_FOUND');
  });

  it('serviço inativo, espécie incompatível e perfil não aprovado retornam 409', async () => {
    const { tutor, body, provider, cat } = await scenario();

    const catPet = await createPet(ctx.prisma, tutor.id, cat.id);
    expect((await book(tutor, { ...body, petId: catPet.id }).expect(409)).body.code).toBe('SERVICE_NOT_AVAILABLE');

    await ctx.prisma.professional.update({
      where: { id: provider.professional.id },
      data: { verificationStatus: 'SUSPENDED' },
    });
    expect((await book(tutor, body).expect(409)).body.code).toBe('PROFESSIONAL_NOT_VERIFIED');
    await ctx.prisma.professional.update({
      where: { id: provider.professional.id },
      data: { verificationStatus: 'APPROVED' },
    });

    await ctx.prisma.clinic.update({ where: { id: provider.clinic.id }, data: { verificationStatus: 'PENDING' } });
    expect((await book(tutor, body).expect(409)).body.code).toBe('CLINIC_NOT_VERIFIED');
    await ctx.prisma.clinic.update({ where: { id: provider.clinic.id }, data: { verificationStatus: 'APPROVED' } });

    await ctx.prisma.service.update({ where: { id: provider.service.id }, data: { active: false } });
    expect((await book(tutor, body).expect(409)).body.code).toBe('SERVICE_NOT_AVAILABLE');
  });

  it('slot ocupado retorna 409 SLOT_NOT_AVAILABLE', async () => {
    const { tutor, body, dog } = await scenario();
    await book(tutor, body).expect(201);
    const pet2 = await createPet(ctx.prisma, tutor.id, dog.id);
    expect((await book(tutor, { ...body, petId: pet2.id }).expect(409)).body.code).toBe('SLOT_NOT_AVAILABLE');
  });

  it('clique repetido com a mesma chave devolve o mesmo agendamento', async () => {
    const { tutor, body } = await scenario();
    const key = randomUUID();
    const first = await book(tutor, body, key).expect(201);
    const second = await book(tutor, body, key).expect(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await ctx.prisma.appointment.count()).toBe(1);

    const reused = await book(tutor, { ...body, clinicId: undefined, petId: randomUUID() }, key).expect(409);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('mesma chave enviada em paralelo cria um único agendamento', async () => {
    const { tutor, body } = await scenario();
    const key = randomUUID();
    const results = await Promise.all([book(tutor, body, key), book(tutor, body, key), book(tutor, body, key)]);
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(await ctx.prisma.appointment.count()).toBe(1);
  });

  it('duas requisições simultâneas pelo mesmo horário: só uma vence', async () => {
    const { body, dog, provider } = await scenario();
    const tutors = await Promise.all(Array.from({ length: 5 }, () => createUser(ctx.prisma, 'TUTOR')));
    const pets = await Promise.all(tutors.map((t) => createPet(ctx.prisma, t.id, dog.id)));

    const results = await Promise.all(tutors.map((t, i) => book(t, { ...body, petId: pets[i].id })));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await ctx.prisma.appointment.count({ where: { slotId: provider.slot.id } })).toBe(1);
  });

  describe('agenda e cancelamento', () => {
    async function booked() {
      const s = await scenario();
      const appointment = (await book(s.tutor, s.body).expect(201)).body.data;
      return { ...s, appointment };
    }

    it('tutor e profissional veem só o que lhes pertence', async () => {
      const { tutor, provider, appointment } = await booked();
      expect((await ctx.http().get('/api/v1/appointments').set(auth(tutor)).expect(200)).body.meta.total).toBe(1);
      expect((await ctx.http().get('/api/v1/appointments').set(auth(provider.user)).expect(200)).body.meta.total).toBe(
        1,
      );

      const stranger = await createUser(ctx.prisma, 'TUTOR');
      expect((await ctx.http().get('/api/v1/appointments').set(auth(stranger)).expect(200)).body.meta.total).toBe(0);
      await ctx.http().get(`/api/v1/appointments/${appointment.id}`).set(auth(stranger)).expect(404);
      await ctx.http().post(`/api/v1/appointments/${appointment.id}/cancel`).set(auth(stranger)).send({}).expect(404);
    });

    it('cancelamento do tutor libera o horário na mesma transação', async () => {
      const { tutor, appointment, provider } = await booked();
      const res = await ctx
        .http()
        .post(`/api/v1/appointments/${appointment.id}/cancel`)
        .set(auth(tutor))
        .send({})
        .expect(200);
      expect(res.body.data.status).toBe('CANCELLED_BY_TUTOR');
      expect((await ctx.prisma.availabilitySlot.findUniqueOrThrow({ where: { id: provider.slot.id } })).status).toBe(
        'AVAILABLE',
      );
      expect(await ctx.prisma.outboxEvent.count({ where: { type: 'APPOINTMENT_CANCELLED' } })).toBe(1);

      const cancelled = await ctx.http().get('/api/v1/appointments?scope=cancelled').set(auth(tutor)).expect(200);
      expect(cancelled.body.meta.total).toBe(1);
    });

    it('cancelamento repetido responde 409', async () => {
      const { tutor, appointment } = await booked();
      await ctx.http().post(`/api/v1/appointments/${appointment.id}/cancel`).set(auth(tutor)).send({}).expect(200);
      const res = await ctx
        .http()
        .post(`/api/v1/appointments/${appointment.id}/cancel`)
        .set(auth(tutor))
        .send({})
        .expect(409);
      expect(res.body.code).toBe('APPOINTMENT_ALREADY_CANCELLED');
    });

    it('profissional precisa informar motivo', async () => {
      const { provider, appointment } = await booked();
      await ctx
        .http()
        .post(`/api/v1/appointments/${appointment.id}/cancel`)
        .set(auth(provider.user))
        .send({})
        .expect(400);
      const res = await ctx
        .http()
        .post(`/api/v1/appointments/${appointment.id}/cancel`)
        .set(auth(provider.user))
        .send({ reason: 'Emergência na clínica' })
        .expect(200);
      expect(res.body.data).toMatchObject({ status: 'CANCELLED_BY_PROVIDER', cancelReason: 'Emergência na clínica' });
    });

    it('consulta iniciada não pode ser cancelada, mas pode ser concluída pelo profissional', async () => {
      const { tutor, provider, appointment } = await booked();
      const past = new Date(Date.now() - 10 * 60000);
      await ctx.prisma.appointment.update({ where: { id: appointment.id }, data: { startsAt: past } });

      const res = await ctx
        .http()
        .post(`/api/v1/appointments/${appointment.id}/cancel`)
        .set(auth(tutor))
        .send({})
        .expect(409);
      expect(res.body.code).toBe('APPOINTMENT_ALREADY_STARTED');

      await ctx.http().post(`/api/v1/appointments/${appointment.id}/complete`).set(auth(tutor)).expect(403);
      const done = await ctx
        .http()
        .post(`/api/v1/appointments/${appointment.id}/complete`)
        .set(auth(provider.user))
        .expect(200);
      expect(done.body.data.status).toBe('COMPLETED');
    });

    it('não conclui antes do horário', async () => {
      const { provider, appointment } = await booked();
      expect(
        (await ctx.http().post(`/api/v1/appointments/${appointment.id}/complete`).set(auth(provider.user)).expect(409))
          .body.code,
      ).toBe('APPOINTMENT_NOT_STARTED');
    });
  });
});
