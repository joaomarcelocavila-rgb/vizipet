import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { conflict, notFound } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

export interface ServiceSnapshot {
  id: string;
  name: string;
  modality: 'IN_PERSON' | 'REMOTE';
  durationMinutes: number;
  priceCents: number | null;
  speciesIds: string[];
  professionalIds: string[];
}

const include = {
  species: { select: { speciesId: true } },
  professionals: { select: { professionalId: true } },
} satisfies Prisma.ServiceInclude;

type ServiceWithLinks = Prisma.ServiceGetPayload<{ include: typeof include }>;

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  listSpecies() {
    return this.prisma.species.findMany({ orderBy: { name: 'asc' } });
  }

  async create(ownerId: string, dto: CreateServiceDto) {
    const professionalIds = dto.professionalIds ?? (await this.defaultProfessionalIds(ownerId));
    await this.assertSpeciesExist(dto.speciesIds);
    await this.assertProfessionalsManageable(ownerId, professionalIds);

    const created = await this.prisma.service.create({
      data: {
        ownerId,
        name: dto.name,
        description: dto.description,
        modality: dto.modality,
        durationMinutes: dto.durationMinutes,
        priceCents: dto.priceCents,
        species: { create: dto.speciesIds.map((speciesId) => ({ speciesId })) },
        professionals: { create: professionalIds.map((professionalId) => ({ professionalId })) },
      },
      include,
    });
    return this.toView(created);
  }

  async listMine(ownerId: string) {
    const services = await this.prisma.service.findMany({ where: { ownerId }, include, orderBy: { createdAt: 'asc' } });
    return services.map((service) => this.toView(service));
  }

  async getOwned(id: string, ownerId: string) {
    return this.toView(await this.requireOwned(id, ownerId));
  }

  async update(id: string, ownerId: string, dto: UpdateServiceDto) {
    await this.requireOwned(id, ownerId);
    if (dto.speciesIds) await this.assertSpeciesExist(dto.speciesIds);
    if (dto.professionalIds) await this.assertProfessionalsManageable(ownerId, dto.professionalIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      const { speciesIds, professionalIds, ...fields } = dto;
      if (speciesIds) {
        await tx.serviceSpecies.deleteMany({ where: { serviceId: id } });
        await tx.serviceSpecies.createMany({ data: speciesIds.map((speciesId) => ({ serviceId: id, speciesId })) });
      }
      if (professionalIds) {
        await tx.serviceProfessional.deleteMany({ where: { serviceId: id } });
        await tx.serviceProfessional.createMany({
          data: professionalIds.map((professionalId) => ({ serviceId: id, professionalId })),
        });
      }
      const result = await tx.service.update({ where: { id }, data: fields, include });
      if (fields.active === false) await this.blockOpenSlots(tx, id);
      return result;
    });
    return this.toView(updated);
  }

  /** Desativa o serviço. Consultas já confirmadas seguem de pé; horários livres futuros são bloqueados. */
  async deactivate(id: string, ownerId: string) {
    await this.requireOwned(id, ownerId);
    return this.prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id }, data: { active: false } });
      const blockedSlots = await this.blockOpenSlots(tx, id);
      const futureAppointments = await tx.appointment.count({
        where: { serviceId: id, status: 'CONFIRMED', startsAt: { gt: new Date() } },
      });
      return { id, active: false, blockedSlots, futureAppointments };
    });
  }

  /** Contrato com o módulo de agendamentos. */
  async validateService(serviceId: string): Promise<ServiceSnapshot> {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId }, include });
    if (!service) throw notFound('SERVICE_NOT_FOUND', 'Serviço não encontrado.');
    if (!service.active) throw conflict('SERVICE_NOT_AVAILABLE', 'Este serviço não está disponível.');
    return {
      id: service.id,
      name: service.name,
      modality: service.modality,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      speciesIds: service.species.map((s) => s.speciesId),
      professionalIds: service.professionals.map((p) => p.professionalId),
    };
  }

  private blockOpenSlots(tx: Prisma.TransactionClient, serviceId: string) {
    return tx.availabilitySlot
      .updateMany({
        where: { serviceId, status: 'AVAILABLE', startsAt: { gt: new Date() } },
        data: { status: 'BLOCKED' },
      })
      .then((result) => result.count);
  }

  private async requireOwned(id: string, ownerId: string) {
    const service = await this.prisma.service.findFirst({ where: { id, ownerId }, include });
    if (!service) throw notFound('SERVICE_NOT_FOUND', 'Serviço não encontrado.');
    return service;
  }

  private async defaultProfessionalIds(ownerId: string) {
    const own = await this.prisma.professional.findUnique({ where: { userId: ownerId }, select: { id: true } });
    if (!own) {
      throw conflict('PROFESSIONAL_NOT_LINKED', 'Informe os profissionais que realizam o serviço.');
    }
    return [own.id];
  }

  private async assertSpeciesExist(speciesIds: string[]) {
    const found = await this.prisma.species.count({ where: { id: { in: speciesIds } } });
    if (found !== speciesIds.length) throw conflict('SPECIES_NOT_FOUND', 'Espécie inexistente.');
  }

  /** O dono só vincula a si mesmo ou a profissionais ligados a clínicas dele. */
  private async assertProfessionalsManageable(ownerId: string, professionalIds: string[]) {
    const allowed = await this.prisma.professional.count({
      where: {
        id: { in: professionalIds },
        OR: [{ userId: ownerId }, { clinics: { some: { clinic: { ownerId } } } }],
      },
    });
    if (allowed !== professionalIds.length) {
      throw conflict('PROFESSIONAL_NOT_LINKED', 'Há profissionais sem vínculo com você ou com suas clínicas.');
    }
  }

  private toView(service: ServiceWithLinks) {
    const { species, professionals, ...rest } = service;
    return {
      ...rest,
      speciesIds: species.map((s) => s.speciesId),
      professionalIds: professionals.map((p) => p.professionalId),
    };
  }
}
