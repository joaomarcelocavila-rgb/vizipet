import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Appointment, Prisma } from '../generated/prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { paginated } from '../common/interceptors/response-envelope.interceptor';
import { AvailabilityService } from '../availability/availability.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OutboxService } from '../notifications/outbox.service';
import { PetOwnershipService } from '../pets/pet-ownership.service';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/types';
import { ProfessionalsService } from '../professionals/professionals.service';
import { ServicesService } from '../services/services.service';
import {
  AppointmentScope,
  CancelAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQuery,
} from './dto/appointment.dto';

const OPERATION = 'CREATE_APPOINTMENT';
const KEY_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pets: PetOwnershipService,
    private readonly services: ServicesService,
    private readonly professionals: ProfessionalsService,
    private readonly clinics: ClinicsService,
    private readonly availability: AvailabilityService,
    private readonly outbox: OutboxService,
  ) {}

  async create(user: AuthenticatedUser, idempotencyKey: string | undefined, dto: CreateAppointmentDto) {
    if (!idempotencyKey) throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'Envie o cabeçalho Idempotency-Key.');
    if (!KEY_FORMAT.test(idempotencyKey)) {
      throw badRequest(
        'IDEMPOTENCY_KEY_INVALID',
        'Idempotency-Key deve ter de 8 a 128 caracteres (letras, números, - e _).',
      );
    }
    const requestHash = createHash('sha256')
      .update(JSON.stringify([dto.petId, dto.serviceId, dto.professionalId, dto.clinicId ?? null, dto.slotId]))
      .digest('hex');

    const previous = await this.prisma.idempotencyKey.findUnique({
      where: { userId_operation_key: { userId: user.id, operation: OPERATION, key: idempotencyKey } },
    });
    if (previous) return this.replay(previous.response, requestHash, user.id);

    const pet = await this.pets.assertPetOwnership(dto.petId, user.id);
    const service = await this.services.validateService(dto.serviceId);
    const professional = await this.professionals.validateProfessional(dto.professionalId);

    if (!service.professionalIds.includes(professional.id)) {
      throw conflict('SERVICE_NOT_AVAILABLE', 'Este profissional não realiza o serviço escolhido.');
    }
    if (!service.speciesIds.includes(pet.speciesId)) {
      throw conflict('SERVICE_NOT_AVAILABLE', 'Este serviço não atende a espécie do pet.');
    }

    const slot = await this.prisma.availabilitySlot.findUnique({ where: { id: dto.slotId } });
    if (!slot || slot.professionalId !== professional.id || slot.serviceId !== service.id) {
      throw conflict('SLOT_NOT_AVAILABLE', 'Este horário não pertence ao serviço e profissional escolhidos.');
    }
    if (dto.clinicId && dto.clinicId !== slot.clinicId) {
      throw conflict('SLOT_NOT_AVAILABLE', 'Este horário não pertence à clínica escolhida.');
    }
    const clinic = slot.clinicId ? await this.clinics.validateClinic(slot.clinicId) : null;
    if (service.modality === 'IN_PERSON' && !clinic) {
      throw conflict('CLINIC_NOT_VERIFIED', 'Atendimento presencial exige clínica verificada.');
    }

    const tutor = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true } });

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyKey.create({ data: { userId: user.id, operation: OPERATION, key: idempotencyKey } });
        const reserved = await this.availability.reserveSlot(slot.id, tx);

        const appointment = await tx.appointment.create({
          data: {
            tutorId: user.id,
            petId: pet.id,
            professionalId: professional.id,
            serviceId: service.id,
            clinicId: clinic?.id ?? null,
            slotId: reserved.id,
            startsAt: reserved.startsAt,
            endsAt: reserved.endsAt,
            snapshot: {
              serviceName: service.name,
              durationMinutes: service.durationMinutes,
              modality: service.modality,
              priceCents: service.priceCents,
              professionalName: professional.name,
              clinicName: clinic?.name ?? null,
              clinicAddress: clinic?.address ?? null,
              petName: pet.name,
              tutorName: tutor.name,
            },
          },
        });

        await tx.idempotencyKey.update({
          where: { userId_operation_key: { userId: user.id, operation: OPERATION, key: idempotencyKey } },
          data: { response: { requestHash, appointmentId: appointment.id } },
        });
        await this.outbox.emitOutbox(
          {
            type: 'APPOINTMENT_CONFIRMED',
            dedupKey: `appointment:${appointment.id}:confirmed`,
            payload: {
              appointmentId: appointment.id,
              tutorId: user.id,
              professionalUserId: professional.userId,
              startsAt: appointment.startsAt.toISOString(),
              serviceName: service.name,
              professionalName: professional.name,
              petName: pet.name,
              tutorName: tutor.name,
            },
          },
          tx,
        );
        return this.toView(appointment);
      });
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency')) {
        // Outra requisição com a mesma chave venceu a corrida: devolve o resultado dela.
        const winner = await this.prisma.idempotencyKey.findUnique({
          where: { userId_operation_key: { userId: user.id, operation: OPERATION, key: idempotencyKey } },
        });
        return this.replay(winner?.response ?? null, requestHash, user.id);
      }
      if (isUniqueViolation(error)) {
        throw conflict('SLOT_NOT_AVAILABLE', 'Este horário não está mais disponível.');
      }
      throw error;
    }
  }

  async list(user: AuthenticatedUser, query: ListAppointmentsQuery) {
    const owner = await this.ownerFilter(user);
    if (!owner) return paginated([], query.page, query.limit, 0);

    const now = new Date();
    const byScope: Record<
      AppointmentScope,
      [Prisma.AppointmentWhereInput, Prisma.AppointmentOrderByWithRelationInput[]]
    > = {
      [AppointmentScope.UPCOMING]: [{ status: 'CONFIRMED', endsAt: { gt: now } }, [{ startsAt: 'asc' }, { id: 'asc' }]],
      [AppointmentScope.PAST]: [
        { OR: [{ status: 'COMPLETED' }, { status: 'CONFIRMED', endsAt: { lte: now } }] },
        [{ startsAt: 'desc' }, { id: 'desc' }],
      ],
      [AppointmentScope.CANCELLED]: [
        { status: { in: ['CANCELLED_BY_TUTOR', 'CANCELLED_BY_PROVIDER'] } },
        [{ startsAt: 'desc' }, { id: 'desc' }],
      ],
    };
    const [scopeWhere, orderBy] = byScope[query.scope];
    const where: Prisma.AppointmentWhereInput = { AND: [owner, scopeWhere] };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({ where, orderBy, skip: query.skip, take: query.limit }),
      this.prisma.appointment.count({ where }),
    ]);
    return paginated(
      items.map((a) => this.toView(a)),
      query.page,
      query.limit,
      total,
    );
  }

  async get(user: AuthenticatedUser, id: string) {
    return this.toView(await this.requireVisible(user, id));
  }

  async cancel(user: AuthenticatedUser, id: string, dto: CancelAppointmentDto) {
    const appointment = await this.requireVisible(user, id);
    const byProvider = user.role === 'PROFESSIONAL';
    if (byProvider && !dto.reason) {
      throw badRequest('VALIDATION_ERROR', 'Informe o motivo do cancelamento.', [
        { field: 'reason', errors: ['reason é obrigatório'] },
      ]);
    }
    this.assertCancellable(appointment);

    const professional = await this.prisma.professional.findUniqueOrThrow({
      where: { id: appointment.professionalId },
      select: { userId: true },
    });
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Condicional: dois cancelamentos simultâneos não liberam o horário duas vezes.
      const { count } = await tx.appointment.updateMany({
        where: { id, status: 'CONFIRMED', startsAt: { gt: now } },
        data: {
          status: byProvider ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_TUTOR',
          cancelReason: dto.reason ?? null,
          cancelledAt: now,
        },
      });
      if (count === 0) throw conflict('APPOINTMENT_ALREADY_CANCELLED', 'Este agendamento não pode mais ser cancelado.');

      await this.availability.releaseSlot(appointment.slotId, tx);
      await this.outbox.emitOutbox(
        {
          type: 'APPOINTMENT_CANCELLED',
          dedupKey: `appointment:${id}:cancelled`,
          payload: {
            appointmentId: id,
            cancelledBy: byProvider ? 'PROVIDER' : 'TUTOR',
            notifyUserId: byProvider ? appointment.tutorId : professional.userId,
            startsAt: appointment.startsAt.toISOString(),
            serviceName: (appointment.snapshot as { serviceName?: string }).serviceName ?? null,
            reason: dto.reason ?? null,
          },
        },
        tx,
      );
      return this.toView(await tx.appointment.findUniqueOrThrow({ where: { id } }));
    });
  }

  async complete(user: AuthenticatedUser, id: string) {
    const appointment = await this.requireVisible(user, id);
    if (appointment.status !== 'CONFIRMED') {
      throw conflict('APPOINTMENT_NOT_COMPLETABLE', 'Só consultas confirmadas podem ser concluídas.');
    }
    if (appointment.startsAt > new Date()) {
      throw conflict('APPOINTMENT_NOT_STARTED', 'A consulta ainda não começou.');
    }
    const { count } = await this.prisma.appointment.updateMany({
      where: { id, status: 'CONFIRMED' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (count === 0) throw conflict('APPOINTMENT_NOT_COMPLETABLE', 'Só consultas confirmadas podem ser concluídas.');
    return this.toView(await this.prisma.appointment.findUniqueOrThrow({ where: { id } }));
  }

  private assertCancellable(appointment: Appointment) {
    if (appointment.status === 'CANCELLED_BY_TUTOR' || appointment.status === 'CANCELLED_BY_PROVIDER') {
      throw conflict('APPOINTMENT_ALREADY_CANCELLED', 'Este agendamento já foi cancelado.');
    }
    if (appointment.status === 'COMPLETED') {
      throw conflict('APPOINTMENT_NOT_CANCELLABLE', 'Consultas concluídas não podem ser canceladas.');
    }
    if (appointment.startsAt <= new Date()) {
      throw conflict('APPOINTMENT_ALREADY_STARTED', 'A consulta já começou e não pode ser cancelada.');
    }
  }

  private async replay(response: Prisma.JsonValue | null, requestHash: string, userId: string) {
    const stored = response as { requestHash?: string; appointmentId?: string } | null;
    if (!stored?.appointmentId) {
      throw conflict('IDEMPOTENCY_IN_PROGRESS', 'Esta requisição ainda está sendo processada. Tente de novo.');
    }
    if (stored.requestHash !== requestHash) {
      throw conflict('IDEMPOTENCY_KEY_REUSED', 'Esta Idempotency-Key já foi usada com outros dados.');
    }
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: stored.appointmentId, tutorId: userId },
    });
    if (!appointment) throw notFound('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    return this.toView(appointment);
  }

  /** Tutor enxerga os próprios; profissional, os vinculados ao perfil dele. */
  private async ownerFilter(user: AuthenticatedUser): Promise<Prisma.AppointmentWhereInput | null> {
    if (user.role === 'TUTOR') return { tutorId: user.id };
    const professional = await this.professionals.findByUser(user.id);
    return professional ? { professionalId: professional.id } : null;
  }

  private async requireVisible(user: AuthenticatedUser, id: string) {
    const owner = await this.ownerFilter(user);
    const appointment = owner ? await this.prisma.appointment.findFirst({ where: { AND: [{ id }, owner] } }) : null;
    if (!appointment) throw notFound('APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    return appointment;
  }

  toView(a: Appointment) {
    return {
      id: a.id,
      status: a.status,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      petId: a.petId,
      serviceId: a.serviceId,
      professionalId: a.professionalId,
      clinicId: a.clinicId,
      slotId: a.slotId,
      snapshot: a.snapshot,
      cancelReason: a.cancelReason,
      cancelledAt: a.cancelledAt,
      completedAt: a.completedAt,
      createdAt: a.createdAt,
    };
  }
}
