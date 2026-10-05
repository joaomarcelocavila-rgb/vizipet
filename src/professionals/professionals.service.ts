import { Injectable } from '@nestjs/common';
import { Professional } from '../generated/prisma/client';
import { conflict, notFound } from '../common/app-exception';
import { toNumber } from '../common/utils/decimal';
import { isUniqueViolation } from '../prisma/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfessionalDto, UpdateProfessionalDto } from './dto/professional.dto';

export interface ProfessionalSnapshot {
  id: string;
  userId: string;
  name: string;
  crmv: string;
}

// Mudar qualquer um destes campos exige nova revisão administrativa.
const SENSITIVE_FIELDS = ['crmvNumber', 'crmvState'] as const;

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMine(userId: string, dto: CreateProfessionalDto) {
    try {
      const created = await this.prisma.professional.create({
        data: { ...dto, userId, verificationStatus: 'PENDING' },
      });
      return this.toOwnerView(created);
    } catch (error) {
      if (isUniqueViolation(error, 'user_id')) {
        throw conflict('PROFESSIONAL_ALREADY_EXISTS', 'Você já possui um perfil profissional.');
      }
      if (isUniqueViolation(error)) {
        throw conflict('CRMV_ALREADY_REGISTERED', 'Este CRMV já está cadastrado.');
      }
      throw error;
    }
  }

  async getMine(userId: string) {
    return this.toOwnerView(await this.requireByUser(userId));
  }

  async updateMine(userId: string, dto: UpdateProfessionalDto) {
    const current = await this.requireByUser(userId);
    const sensitiveChanged = SENSITIVE_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== current[field],
    );
    const needsReview = sensitiveChanged && current.verificationStatus === 'APPROVED';

    try {
      const updated = await this.prisma.professional.update({
        where: { id: current.id },
        data: { ...dto, ...(needsReview ? { verificationStatus: 'PENDING' } : {}) },
      });
      // Campos não sensíveis de um perfil já aprovado vão ao ar sem nova revisão.
      if (updated.verificationStatus === 'APPROVED') {
        await this.prisma.professional.update({
          where: { id: updated.id },
          data: { publicProfile: this.buildPublicProfile(updated) },
        });
      }
      return this.toOwnerView(await this.requireByUser(userId));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('CRMV_ALREADY_REGISTERED', 'Este CRMV já está cadastrado.');
      }
      throw error;
    }
  }

  async findByUser(userId: string) {
    return this.prisma.professional.findUnique({ where: { userId } });
  }

  async requireByUser(userId: string) {
    const professional = await this.findByUser(userId);
    if (!professional) throw notFound('PROFESSIONAL_NOT_FOUND', 'Cadastre seu perfil profissional primeiro.');
    return professional;
  }

  /** Contrato com o módulo de agendamentos: só profissional aprovado e com conta ativa é reservável. */
  async validateProfessional(professionalId: string): Promise<ProfessionalSnapshot> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: { select: { status: true } } },
    });
    if (!professional) throw notFound('PROFESSIONAL_NOT_FOUND', 'Profissional não encontrado.');
    if (professional.verificationStatus !== 'APPROVED' || professional.user.status !== 'ACTIVE') {
      throw conflict('PROFESSIONAL_NOT_VERIFIED', 'Este profissional não pode receber agendamentos.');
    }
    return {
      id: professional.id,
      userId: professional.userId,
      name: professional.displayName,
      crmv: `${professional.crmvNumber}/${professional.crmvState}`,
    };
  }

  /** Versão pública, gravada na aprovação. Nada administrativo entra aqui. */
  buildPublicProfile(professional: Professional) {
    return {
      id: professional.id,
      name: professional.displayName,
      specialty: professional.specialty,
      bio: professional.bio,
      crmv: `${professional.crmvNumber}/${professional.crmvState}`,
      city: professional.city,
      neighborhood: professional.neighborhood,
    };
  }

  toOwnerView(professional: Professional) {
    const { latitude, longitude, publicProfile: _publicProfile, ...rest } = professional;
    return { ...rest, latitude: toNumber(latitude), longitude: toNumber(longitude) };
  }
}
