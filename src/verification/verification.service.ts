import { Injectable, Logger } from '@nestjs/common';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { ClinicsService } from '../clinics/clinics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { StorageService } from '../storage/storage.service';
import {
  DocumentScopeQuery,
  SubmitVerificationDto,
  UploadDocumentDto,
  VerificationTargetDto,
} from './dto/verification.dto';

const MAX_DOCUMENTS_PER_TARGET = 10;
const SUBMITTABLE = ['PENDING', 'CHANGES_REQUESTED', 'REJECTED'];

export interface Scope {
  professionalId?: string;
  clinicId?: string;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly professionals: ProfessionalsService,
    private readonly clinics: ClinicsService,
  ) {}

  async uploadDocument(
    userId: string,
    dto: UploadDocumentDto,
    file: { buffer: Buffer; originalname: string } | undefined,
  ) {
    const scope = await this.resolveScope(userId, dto.target, dto.clinicId);
    if (dto.target === 'CLINIC' && dto.kind === 'CRMV') {
      throw badRequest('VALIDATION_ERROR', 'Documento CRMV pertence ao perfil profissional.');
    }
    const existing = await this.prisma.verificationDocument.count({ where: scope });
    if (existing >= MAX_DOCUMENTS_PER_TARGET) {
      throw conflict('DOCUMENT_LIMIT_REACHED', 'Limite de documentos atingido. Remova algum antes de enviar outro.');
    }

    const stored = await this.storage.save(file, 'document');
    try {
      const document = await this.prisma.verificationDocument.create({
        data: {
          ...scope,
          kind: dto.kind,
          storagePath: stored.path,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      });
      return this.toView(document);
    } catch (error) {
      await this.storage
        .remove(stored.path)
        .catch(() => this.logger.warn('Arquivo órfão após falha ao gravar metadados.'));
      throw error;
    }
  }

  async listDocuments(userId: string, query: DocumentScopeQuery) {
    const scope = await this.resolveScope(userId, query.target, query.clinicId);
    const documents = await this.prisma.verificationDocument.findMany({ where: scope, orderBy: { createdAt: 'asc' } });
    return documents.map((document) => this.toView(document));
  }

  async deleteDocument(userId: string, documentId: string) {
    const document = await this.prisma.verificationDocument.findUnique({ where: { id: documentId } });
    if (!document || !(await this.ownsDocument(userId, document))) {
      throw notFound('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }
    await this.prisma.verificationDocument.delete({ where: { id: documentId } });
    await this.storage
      .remove(document.storagePath)
      .catch(() => this.logger.warn('Falha ao remover arquivo do storage.'));
  }

  async submit(userId: string, dto: SubmitVerificationDto) {
    const scope = await this.resolveScope(userId, dto.target, dto.clinicId);
    const entity =
      dto.target === 'PROFESSIONAL'
        ? await this.prisma.professional.findUniqueOrThrow({ where: { id: scope.professionalId } })
        : await this.prisma.clinic.findUniqueOrThrow({ where: { id: scope.clinicId } });

    if (entity.verificationStatus === 'APPROVED') {
      throw conflict('ALREADY_APPROVED', 'Este perfil já está aprovado.');
    }
    if (!SUBMITTABLE.includes(entity.verificationStatus)) {
      throw conflict('PROFILE_SUSPENDED', 'Perfil suspenso. Fale com o suporte.');
    }
    const open = await this.prisma.verificationRequest.count({ where: { ...scope, status: 'PENDING' } });
    if (open > 0) throw conflict('VERIFICATION_ALREADY_PENDING', 'Já existe uma solicitação em análise.');

    const missing = await this.missingForReview(dto.target, scope);
    if (missing.length > 0) {
      throw conflict('VERIFICATION_INCOMPLETE', 'Complete o cadastro antes de enviar para análise.', { missing });
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.verificationRequest.create({
        data: { target: dto.target, ...scope, status: 'PENDING' },
      });
      if (scope.professionalId) {
        await tx.professional.update({ where: { id: scope.professionalId }, data: { verificationStatus: 'PENDING' } });
      } else {
        await tx.clinic.update({ where: { id: scope.clinicId }, data: { verificationStatus: 'PENDING' } });
      }
      return { id: request.id, target: request.target, status: request.status, createdAt: request.createdAt };
    });
  }

  async listMine(userId: string) {
    const professional = await this.professionals.findByUser(userId);
    const clinics = await this.prisma.clinic.findMany({ where: { ownerId: userId }, select: { id: true } });
    const requests = await this.prisma.verificationRequest.findMany({
      where: {
        OR: [
          ...(professional ? [{ professionalId: professional.id }] : []),
          ...(clinics.length ? [{ clinicId: { in: clinics.map((c) => c.id) } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        target: true,
        professionalId: true,
        clinicId: true,
        status: true,
        reason: true,
        decidedAt: true,
        createdAt: true,
      },
    });
    return requests;
  }

  /** Lista o que ainda falta para o perfil poder ser analisado (usada também na aprovação). */
  async missingForReview(target: 'PROFESSIONAL' | 'CLINIC', scope: Scope): Promise<string[]> {
    const missing: string[] = [];
    const kinds = new Set(
      (await this.prisma.verificationDocument.findMany({ where: scope, select: { kind: true } })).map((d) => d.kind),
    );

    if (target === 'PROFESSIONAL') {
      const p = await this.prisma.professional.findUniqueOrThrow({ where: { id: scope.professionalId } });
      if (!p.city) missing.push('city');
      if (!p.neighborhood) missing.push('neighborhood');
      if (!p.specialty) missing.push('specialty');
      if (!kinds.has('CRMV')) missing.push('document:CRMV');
      if (!kinds.has('IDENTITY')) missing.push('document:IDENTITY');
    } else {
      const c = await this.prisma.clinic.findUniqueOrThrow({ where: { id: scope.clinicId } });
      if (!c.responsibleVet) missing.push('responsibleVet');
      if (!c.responsibleCrmv) missing.push('responsibleCrmv');
      if (!c.phone) missing.push('phone');
      if (!kinds.has('CLINIC_LICENSE')) missing.push('document:CLINIC_LICENSE');
    }
    return missing;
  }

  async createDocumentLink(documentId: string, ttlSeconds = 120) {
    const document = await this.prisma.verificationDocument.findUnique({ where: { id: documentId } });
    if (!document) throw notFound('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    return { url: await this.storage.createSignedUrl(document.storagePath, ttlSeconds), expiresInSeconds: ttlSeconds };
  }

  private async resolveScope(
    userId: string,
    target: VerificationTargetDto | 'PROFESSIONAL' | 'CLINIC',
    clinicId?: string,
  ): Promise<Scope> {
    if (target === 'PROFESSIONAL') {
      const professional = await this.professionals.requireByUser(userId);
      return { professionalId: professional.id };
    }
    if (!clinicId) throw badRequest('VALIDATION_ERROR', 'clinicId é obrigatório para clínicas.');
    const clinic = await this.clinics.getOwned(clinicId, userId);
    return { clinicId: clinic.id };
  }

  private async ownsDocument(userId: string, document: { professionalId: string | null; clinicId: string | null }) {
    if (document.professionalId) {
      const professional = await this.professionals.findByUser(userId);
      return professional?.id === document.professionalId;
    }
    const clinic = await this.prisma.clinic.findFirst({
      where: { id: document.clinicId!, ownerId: userId },
      select: { id: true },
    });
    return Boolean(clinic);
  }

  // O caminho no storage nunca sai do back end.
  private toView(document: {
    id: string;
    kind: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }) {
    const { id, kind, originalName, mimeType, sizeBytes, createdAt } = document;
    return { id, kind, originalName, mimeType, sizeBytes, createdAt };
  }
}
