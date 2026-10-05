import { Injectable } from '@nestjs/common';
import { Clinic } from '../generated/prisma/client';
import { conflict, notFound } from '../common/app-exception';
import { toNumber } from '../common/utils/decimal';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicDto, UpdateClinicDto } from './dto/clinic.dto';

export interface ClinicSnapshot {
  id: string;
  name: string;
  address: string;
}

const SENSITIVE_FIELDS = [
  'name',
  'addressLine',
  'neighborhood',
  'city',
  'state',
  'responsibleVet',
  'responsibleCrmv',
  'emergency24h',
] as const;

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateClinicDto) {
    const clinic = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clinic.create({ data: { ...dto, ownerId, verificationStatus: 'PENDING' } });
      // Quem já tem perfil profissional passa a atender na própria clínica.
      const professional = await tx.professional.findUnique({ where: { userId: ownerId }, select: { id: true } });
      if (professional) {
        await tx.clinicProfessional.create({ data: { clinicId: created.id, professionalId: professional.id } });
      }
      return created;
    });
    return this.toOwnerView(clinic);
  }

  async listMine(ownerId: string) {
    const clinics = await this.prisma.clinic.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } });
    return clinics.map((clinic) => this.toOwnerView(clinic));
  }

  async getOwned(clinicId: string, ownerId: string) {
    return this.toOwnerView(await this.requireOwned(clinicId, ownerId));
  }

  async update(clinicId: string, ownerId: string, dto: UpdateClinicDto) {
    const current = await this.requireOwned(clinicId, ownerId);
    const sensitiveChanged = SENSITIVE_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== current[field],
    );
    const needsReview = sensitiveChanged && current.verificationStatus === 'APPROVED';

    const updated = await this.prisma.clinic.update({
      where: { id: clinicId },
      data: { ...dto, ...(needsReview ? { verificationStatus: 'PENDING' } : {}) },
    });
    if (updated.verificationStatus === 'APPROVED') {
      await this.prisma.clinic.update({
        where: { id: clinicId },
        data: { publicProfile: this.buildPublicProfile(updated) },
      });
    }
    return this.toOwnerView(await this.requireOwned(clinicId, ownerId));
  }

  async linkProfessional(clinicId: string, ownerId: string, professionalId: string) {
    await this.requireOwned(clinicId, ownerId);
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true },
    });
    if (!professional) throw notFound('PROFESSIONAL_NOT_FOUND', 'Profissional não encontrado.');
    await this.prisma.clinicProfessional.upsert({
      where: { clinicId_professionalId: { clinicId, professionalId } },
      create: { clinicId, professionalId },
      update: {},
    });
  }

  async unlinkProfessional(clinicId: string, ownerId: string, professionalId: string) {
    await this.requireOwned(clinicId, ownerId);
    const futureSlots = await this.prisma.availabilitySlot.count({
      where: { clinicId, professionalId, startsAt: { gt: new Date() }, status: 'BOOKED' },
    });
    if (futureSlots > 0) {
      throw conflict('CLINIC_LINK_IN_USE', 'Há consultas futuras agendadas neste vínculo. Cancele-as antes.');
    }
    await this.prisma.clinicProfessional.deleteMany({ where: { clinicId, professionalId } });
  }

  /** Contrato com o módulo de agendamentos. */
  async validateClinic(clinicId: string): Promise<ClinicSnapshot> {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw notFound('CLINIC_NOT_FOUND', 'Clínica não encontrada.');
    if (clinic.verificationStatus !== 'APPROVED') {
      throw conflict('CLINIC_NOT_VERIFIED', 'Esta clínica não pode receber agendamentos.');
    }
    return {
      id: clinic.id,
      name: clinic.name,
      address: `${clinic.addressLine}, ${clinic.neighborhood}, ${clinic.city}/${clinic.state}`,
    };
  }

  buildPublicProfile(clinic: Clinic) {
    return {
      id: clinic.id,
      name: clinic.name,
      description: clinic.description,
      phone: clinic.phone,
      address: `${clinic.addressLine}, ${clinic.neighborhood}, ${clinic.city}/${clinic.state}`,
      neighborhood: clinic.neighborhood,
      city: clinic.city,
      state: clinic.state,
      latitude: toNumber(clinic.latitude),
      longitude: toNumber(clinic.longitude),
      emergency24h: clinic.emergency24h,
    };
  }

  private async requireOwned(clinicId: string, ownerId: string) {
    const clinic = await this.prisma.clinic.findFirst({ where: { id: clinicId, ownerId } });
    if (!clinic) throw notFound('CLINIC_NOT_FOUND', 'Clínica não encontrada.');
    return clinic;
  }

  private toOwnerView(clinic: Clinic) {
    const { publicProfile: _publicProfile, latitude, longitude, ...rest } = clinic;
    return { ...rest, latitude: toNumber(latitude), longitude: toNumber(longitude) };
  }
}
