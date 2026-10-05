import { Injectable } from '@nestjs/common';
import { AvailabilitySlot, Prisma } from '../generated/prisma/client';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { paginated } from '../common/interceptors/response-envelope.interceptor';
import { addDays, APP_TIME_ZONE, daysBetween, isValidTimeZone, weekdayOf, zonedToUtc } from '../common/utils/time';
import { PrismaService } from '../prisma/prisma.service';
import { isExclusionViolation, TransactionClient } from '../prisma/types';
import { ProfessionalsService } from '../professionals/professionals.service';
import { BatchSlotsDto, CreateSlotDto, ListSlotsQuery } from './dto/availability.dto';

export const MAX_BATCH_DAYS = 90;
const MAX_BATCH_SLOTS = 2000;
const MAX_SLOT_MINUTES = 8 * 60;

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
  ) {}

  async create(userId: string, dto: CreateSlotDto) {
    const professional = await this.professionals.requireByUser(userId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    this.assertRange(startsAt, endsAt);
    await this.assertCanOffer(professional.id, dto.serviceId, dto.clinicId);
    await this.assertNoOverlap(professional.id, [{ startsAt, endsAt }]);

    try {
      return await this.prisma.availabilitySlot.create({
        data: { professionalId: professional.id, serviceId: dto.serviceId, clinicId: dto.clinicId, startsAt, endsAt },
      });
    } catch (error) {
      if (isExclusionViolation(error)) throw this.overlapError();
      throw error;
    }
  }

  async createBatch(userId: string, dto: BatchSlotsDto) {
    const professional = await this.professionals.requireByUser(userId);
    const timeZone = dto.timeZone ?? APP_TIME_ZONE;
    if (!isValidTimeZone(timeZone)) throw badRequest('VALIDATION_ERROR', 'Fuso horário inválido.');

    const span = daysBetween(dto.fromDate, dto.toDate);
    if (Number.isNaN(span) || span < 0)
      throw badRequest('VALIDATION_ERROR', 'toDate deve ser igual ou posterior a fromDate.');
    if (span + 1 > MAX_BATCH_DAYS) {
      throw badRequest('BATCH_TOO_LONG', `O período máximo é de ${MAX_BATCH_DAYS} dias.`);
    }
    if (dto.startTime >= dto.endTime) throw badRequest('VALIDATION_ERROR', 'startTime deve ser anterior a endTime.');

    const service = await this.assertCanOffer(professional.id, dto.serviceId, dto.clinicId);
    const step = service.durationMinutes;
    const gap = dto.gapMinutes ?? 0;

    const slots: { startsAt: Date; endsAt: Date }[] = [];
    for (let i = 0; i <= span; i++) {
      const day = addDays(dto.fromDate, i);
      if (!dto.weekdays.includes(weekdayOf(day))) continue;
      const dayStart = zonedToUtc(day, dto.startTime, timeZone);
      const dayEnd = zonedToUtc(day, dto.endTime, timeZone);
      for (let t = dayStart.getTime(); t + step * 60000 <= dayEnd.getTime(); t += (step + gap) * 60000) {
        slots.push({ startsAt: new Date(t), endsAt: new Date(t + step * 60000) });
      }
    }
    if (slots.length === 0) throw badRequest('NO_SLOTS_GENERATED', 'Nenhum horário cabe nesse período.');
    if (slots.length > MAX_BATCH_SLOTS)
      throw badRequest('BATCH_TOO_LARGE', `Limite de ${MAX_BATCH_SLOTS} horários por lote.`);
    if (slots[0].startsAt <= new Date()) throw badRequest('SLOT_IN_PAST', 'O lote contém horários que já passaram.');

    await this.assertNoOverlap(professional.id, slots);

    try {
      const result = await this.prisma.availabilitySlot.createMany({
        data: slots.map((s) => ({
          ...s,
          professionalId: professional.id,
          serviceId: dto.serviceId,
          clinicId: dto.clinicId,
        })),
      });
      return { created: result.count, firstStartsAt: slots[0].startsAt, lastEndsAt: slots[slots.length - 1].endsAt };
    } catch (error) {
      if (isExclusionViolation(error)) throw this.overlapError();
      throw error;
    }
  }

  async listMine(userId: string, query: ListSlotsQuery) {
    const professional = await this.professionals.requireByUser(userId);
    const where: Prisma.AvailabilitySlotWhereInput = {
      professionalId: professional.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.from || query.to
        ? {
            startsAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.availabilitySlot.findMany({
        where,
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.availabilitySlot.count({ where }),
    ]);
    return paginated(items, query.page, query.limit, total);
  }

  async block(userId: string, slotId: string) {
    return this.transition(userId, slotId, 'AVAILABLE', 'BLOCKED');
  }

  async unblock(userId: string, slotId: string) {
    return this.transition(userId, slotId, 'BLOCKED', 'AVAILABLE');
  }

  async remove(userId: string, slotId: string) {
    const slot = await this.requireOwnSlot(userId, slotId);
    if (slot.status === 'BOOKED') throw conflict('SLOT_NOT_AVAILABLE', 'Este horário possui consulta marcada.');
    await this.prisma.availabilitySlot.delete({ where: { id: slotId } });
  }

  /**
   * Reserva atômica: só vira BOOKED quem encontrar o horário AVAILABLE e futuro.
   * Em disputa, a segunda requisição enxerga a linha já atualizada e recebe 409.
   */
  async reserveSlot(slotId: string, tx: TransactionClient): Promise<AvailabilitySlot> {
    const { count } = await tx.availabilitySlot.updateMany({
      where: { id: slotId, status: 'AVAILABLE', startsAt: { gt: new Date() } },
      data: { status: 'BOOKED' },
    });
    if (count === 0) throw conflict('SLOT_NOT_AVAILABLE', 'Este horário não está mais disponível.');
    return tx.availabilitySlot.findUniqueOrThrow({ where: { id: slotId } });
  }

  async releaseSlot(slotId: string, tx: TransactionClient): Promise<void> {
    await tx.availabilitySlot.updateMany({ where: { id: slotId, status: 'BOOKED' }, data: { status: 'AVAILABLE' } });
  }

  private async transition(userId: string, slotId: string, from: 'AVAILABLE' | 'BLOCKED', to: 'AVAILABLE' | 'BLOCKED') {
    const slot = await this.requireOwnSlot(userId, slotId);
    if (slot.status !== from)
      throw conflict('SLOT_NOT_AVAILABLE', 'O estado atual do horário não permite essa operação.');
    const { count } = await this.prisma.availabilitySlot.updateMany({
      where: { id: slotId, status: from },
      data: { status: to },
    });
    if (count === 0) throw conflict('SLOT_NOT_AVAILABLE', 'O estado atual do horário não permite essa operação.');
    return this.prisma.availabilitySlot.findUniqueOrThrow({ where: { id: slotId } });
  }

  private async requireOwnSlot(userId: string, slotId: string) {
    const professional = await this.professionals.requireByUser(userId);
    const slot = await this.prisma.availabilitySlot.findFirst({
      where: { id: slotId, professionalId: professional.id },
    });
    if (!slot) throw notFound('SLOT_NOT_FOUND', 'Horário não encontrado.');
    return slot;
  }

  private assertRange(startsAt: Date, endsAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw badRequest('VALIDATION_ERROR', 'Data inválida.');
    }
    if (startsAt >= endsAt) throw badRequest('INVALID_RANGE', 'O início deve ser anterior ao término.');
    if (startsAt <= new Date()) throw badRequest('SLOT_IN_PAST', 'O horário precisa ser futuro.');
    if (endsAt.getTime() - startsAt.getTime() > MAX_SLOT_MINUTES * 60000) {
      throw badRequest('INVALID_RANGE', 'Um horário não pode passar de 8 horas.');
    }
  }

  private async assertCanOffer(professionalId: string, serviceId: string, clinicId?: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, professionals: { some: { professionalId } } },
    });
    if (!service) throw conflict('PROFESSIONAL_NOT_LINKED', 'Você não realiza este serviço.');
    if (!service.active) throw conflict('SERVICE_NOT_AVAILABLE', 'Serviço inativo não recebe novos horários.');

    if (service.modality === 'IN_PERSON' && !clinicId) {
      throw badRequest('CLINIC_REQUIRED', 'Serviço presencial exige a clínica do atendimento.');
    }
    if (clinicId) {
      const link = await this.prisma.clinicProfessional.findUnique({
        where: { clinicId_professionalId: { clinicId, professionalId } },
      });
      if (!link) throw conflict('CLINIC_NOT_LINKED', 'Você não está vinculado a esta clínica.');
    }
    return service;
  }

  private async assertNoOverlap(professionalId: string, slots: { startsAt: Date; endsAt: Date }[]) {
    const min = slots.reduce((a, s) => (s.startsAt < a ? s.startsAt : a), slots[0].startsAt);
    const max = slots.reduce((a, s) => (s.endsAt > a ? s.endsAt : a), slots[0].endsAt);
    const existing = await this.prisma.availabilitySlot.findMany({
      where: { professionalId, startsAt: { lt: max }, endsAt: { gt: min } },
      select: { startsAt: true, endsAt: true },
    });
    const clash = slots.find((s) => existing.some((e) => e.startsAt < s.endsAt && e.endsAt > s.startsAt));
    if (clash) throw this.overlapError(clash.startsAt);
  }

  private overlapError(at?: Date) {
    return conflict(
      'SLOT_OVERLAP',
      'Já existe um horário seu que se sobrepõe a esse intervalo.',
      at ? { startsAt: at.toISOString() } : undefined,
    );
  }
}
