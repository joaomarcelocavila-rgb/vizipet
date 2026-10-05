import { randomUUID } from 'node:crypto';
import { MAX_ATTEMPTS } from '../src/notifications/outbox.processor';
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

describe('G4/G6 Outbox, notificações e jobs', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
    ctx.mail.failNext = 0;
  });

  const runJob = (name: string, secret = 'cron-de-teste') =>
    ctx.http().post(`/api/v1/internal/jobs/${name}`).set('X-Cron-Secret', secret);

  async function bookedAppointment() {
    const { dog } = await createSpecies(ctx.prisma);
    const provider = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    const tutor = await createUser(ctx.prisma, 'TUTOR');
    const pet = await createPet(ctx.prisma, tutor.id, dog.id);
    const appointment = (
      await ctx
        .http()
        .post('/api/v1/appointments')
        .set(auth(tutor))
        .set('Idempotency-Key', randomUUID())
        .send({
          petId: pet.id,
          serviceId: provider.service.id,
          professionalId: provider.professional.id,
          slotId: provider.slot.id,
        })
        .expect(201)
    ).body.data;
    return { provider, tutor, appointment };
  }

  it('segredo incorreto não executa job', async () => {
    await runJob('outbox', 'errado').expect(401);
    await ctx.http().post('/api/v1/internal/jobs/outbox').expect(401);
  });

  it('processa o evento: notifica tutor e profissional, uma vez só', async () => {
    const { tutor, provider } = await bookedAppointment();
    const first = await runJob('outbox').expect(200);
    expect(first.body.data.outbox).toEqual({ claimed: 1, processed: 1, failed: 0 });
    expect(ctx.mail.sent).toHaveLength(2);

    await ctx.prisma.outboxEvent.updateMany({ data: { status: 'PENDING', nextAttemptAt: new Date(0) } });
    await runJob('outbox').expect(200);
    expect(ctx.mail.sent).toHaveLength(2);
    expect(await ctx.prisma.notification.count({ where: { channel: 'IN_APP' } })).toBe(2);

    const list = await ctx.http().get('/api/v1/notifications').set(auth(tutor)).expect(200);
    expect(list.body.data[0].title).toBe('Consulta confirmada');
    expect(list.body.meta.unread).toBe(1);
    expect(
      (await ctx.http().get('/api/v1/notifications').set(auth(provider.user)).expect(200)).body.data[0].title,
    ).toBe('Nova consulta agendada');
  });

  it('falha do e-mail não desfaz o agendamento e é tentada de novo', async () => {
    const { appointment } = await bookedAppointment();
    ctx.mail.failNext = 1;
    const run = await runJob('outbox').expect(200);
    expect(run.body.data.outbox.failed).toBe(1);

    const event = await ctx.prisma.outboxEvent.findFirstOrThrow();
    expect(event).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(event.lastError).toContain('provedor indisponível');
    expect((await ctx.prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status).toBe(
      'CONFIRMED',
    );

    await ctx.prisma.outboxEvent.update({ where: { id: event.id }, data: { nextAttemptAt: new Date(0) } });
    await runJob('outbox').expect(200);
    expect((await ctx.prisma.outboxEvent.findFirstOrThrow()).status).toBe('PROCESSED');
    expect(ctx.mail.sent).toHaveLength(2);
  });

  it(`após ${MAX_ATTEMPTS} tentativas o evento fica FAILED`, async () => {
    await bookedAppointment();
    ctx.mail.failNext = 100;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await ctx.prisma.outboxEvent.updateMany({ data: { nextAttemptAt: new Date(0) } });
      await runJob('outbox').expect(200);
    }
    expect(await ctx.prisma.outboxEvent.findFirstOrThrow()).toMatchObject({ status: 'FAILED', attempts: MAX_ATTEMPTS });
  });

  it('preferência de e-mail desativada mantém só a notificação interna', async () => {
    const { tutor } = await bookedAppointment();
    await ctx.prisma.notificationPreference.create({ data: { userId: tutor.id, emailEnabled: false } });
    await runJob('outbox').expect(200);
    expect(ctx.mail.sent).toHaveLength(1); // só o profissional
    expect(await ctx.prisma.notification.count({ where: { userId: tutor.id, channel: 'IN_APP' } })).toBe(1);
  });

  it('usuário não lê notificação alheia', async () => {
    const { tutor } = await bookedAppointment();
    await runJob('outbox').expect(200);
    const notification = await ctx.prisma.notification.findFirstOrThrow({ where: { userId: tutor.id } });
    const stranger = await createUser(ctx.prisma, 'TUTOR');
    await ctx.http().patch(`/api/v1/notifications/${notification.id}/read`).set(auth(stranger)).expect(404);

    await ctx.http().patch(`/api/v1/notifications/${notification.id}/read`).set(auth(tutor)).expect(200);
    expect(
      (await ctx.http().post('/api/v1/notifications/read-all').set(auth(tutor)).expect(201)).body.data.updated,
    ).toBe(0);
  });

  it('execuções simultâneas do processador não duplicam mensagens', async () => {
    for (let i = 0; i < 3; i++) await bookedAppointment();
    await Promise.all([runJob('outbox'), runJob('outbox'), runJob('outbox')]);
    expect(ctx.mail.sent).toHaveLength(6);
    expect(await ctx.prisma.outboxEvent.count({ where: { status: 'PROCESSED' } })).toBe(3);
  });

  it('evento preso em PROCESSING é retomado quando a trava expira', async () => {
    await bookedAppointment();
    await ctx.prisma.outboxEvent.updateMany({
      data: { status: 'PROCESSING', attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) },
    });
    await runJob('outbox').expect(200);
    expect(await ctx.prisma.outboxEvent.findFirstOrThrow()).toMatchObject({ status: 'PROCESSED', attempts: 2 });
  });

  it('lembrete de 24 h: único mesmo com execuções repetidas e simultâneas', async () => {
    const { appointment, tutor } = await bookedAppointment();
    await ctx.prisma.appointment.update({
      where: { id: appointment.id },
      data: { startsAt: new Date(Date.now() + 20 * 3600_000), createdAt: new Date(Date.now() - 3 * 86400_000) },
    });

    await Promise.all([runJob('reminders'), runJob('reminders')]);
    await runJob('reminders').expect(200);
    expect(await ctx.prisma.outboxEvent.count({ where: { type: 'APPOINTMENT_REMINDER_24H' } })).toBe(1);

    await runJob('outbox').expect(200);
    await runJob('outbox').expect(200);
    const reminders = await ctx.prisma.notification.findMany({
      where: { userId: tutor.id, type: 'APPOINTMENT_REMINDER_24H', channel: 'IN_APP' },
    });
    expect(reminders).toHaveLength(1);
    expect(reminders[0].deduplicationKey).toBe(`appointment:${appointment.id}:reminder:24h:${tutor.id}`);
  });

  it('cancelamento avisa a outra parte', async () => {
    const { appointment, tutor, provider } = await bookedAppointment();
    await ctx.http().post(`/api/v1/appointments/${appointment.id}/cancel`).set(auth(tutor)).send({}).expect(200);
    await runJob('outbox').expect(200);
    const toProvider = await ctx.prisma.notification.findMany({
      where: { userId: provider.user.id, type: 'APPOINTMENT_CANCELLED' },
    });
    expect(toProvider.length).toBeGreaterThan(0);
  });
});
