import { Injectable } from '@nestjs/common';
import { VerificationRequest } from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { paginated } from '../common/interceptors/response-envelope.interceptor';
import { ClinicsService } from '../clinics/clinics.service';
import { OutboxService } from '../notifications/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { VerificationService } from '../verification/verification.service';
import { AuditQuery, Decision, DecisionDto, ListVerificationRequestsQuery } from './dto/admin.dto';

const OUTCOME = {
  [Decision.APPROVE]: 'APPROVED',
  [Decision.REQUEST_CHANGES]: 'CHANGES_REQUESTED',
  [Decision.REJECT]: 'REJECTED',
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly verification: VerificationService,
    private readonly professionals: ProfessionalsService,
    private readonly clinics: ClinicsService,
  ) {}

  async listRequests(query: ListVerificationRequestsQuery) {
    const where = { status: query.status };
    const [requests, total] = await Promise.all([
      this.prisma.verificationRequest.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);
    const subjects = await this.subjectsFor(requests);
    // Sem documentos aqui: só metadados do pedido e um resumo do solicitante.
    return paginated(
      requests.map((r) => ({ ...this.requestView(r), subject: subjects.get(r.id) ?? null })),
      query.page,
      query.limit,
      total,
    );
  }

  async getRequest(id: string) {
    const request = await this.requireRequest(id);
    const scope = request.professionalId ? { professionalId: request.professionalId } : { clinicId: request.clinicId! };
    const [documents, subjects, missing] = await Promise.all([
      this.prisma.verificationDocument.findMany({
        where: scope,
        select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.subjectsFor([request]),
      this.verification.missingForReview(request.target, scope),
    ]);
    return { ...this.requestView(request), subject: subjects.get(request.id) ?? null, documents, missing };
  }

  /** Gera link curto para um documento do pedido e deixa a visualização registrada. */
  async createDocumentLink(adminId: string, requestId: string, documentId: string) {
    const request = await this.requireRequest(requestId);
    const document = await this.prisma.verificationDocument.findFirst({
      where: {
        id: documentId,
        ...(request.professionalId ? { professionalId: request.professionalId } : { clinicId: request.clinicId! }),
      },
      select: { id: true, kind: true },
    });
    if (!document) throw notFound('DOCUMENT_NOT_FOUND', 'Documento não encontrado neste pedido.');

    await this.audit.record({
      actorId: adminId,
      action: 'VERIFICATION_DOCUMENT_VIEWED',
      entityType: 'VerificationRequest',
      entityId: requestId,
      metadata: { documentId: document.id, kind: document.kind },
    });
    return this.verification.createDocumentLink(document.id, 120);
  }

  async decide(adminId: string, requestId: string, dto: DecisionDto) {
    const request = await this.requireRequest(requestId);
    if (request.status !== 'PENDING') {
      throw conflict('REQUEST_ALREADY_DECIDED', 'Este pedido já foi decidido.');
    }
    if (dto.decision !== Decision.APPROVE && !dto.reason) {
      throw badRequest('REASON_REQUIRED', 'Informe a justificativa da decisão.', [
        { field: 'reason', errors: ['reason é obrigatório'] },
      ]);
    }

    const scope = request.professionalId ? { professionalId: request.professionalId } : { clinicId: request.clinicId! };
    const entity = request.professionalId
      ? await this.prisma.professional.findUniqueOrThrow({ where: { id: request.professionalId } })
      : await this.prisma.clinic.findUniqueOrThrow({ where: { id: request.clinicId! } });
    if (entity.verificationStatus === 'SUSPENDED') {
      throw conflict('PROFILE_SUSPENDED', 'O perfil está suspenso.');
    }
    if (dto.decision === Decision.APPROVE) {
      const missing = await this.verification.missingForReview(request.target, scope);
      if (missing.length > 0) {
        throw conflict('VERIFICATION_INCOMPLETE', 'O perfil ainda está incompleto.', { missing });
      }
    }

    const outcome = OUTCOME[dto.decision];
    const now = new Date();
    const ownerUserId = request.professionalId
      ? (entity as { userId: string }).userId
      : (entity as { ownerId: string | null }).ownerId;

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.verificationRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { status: outcome, decidedById: adminId, decidedAt: now, reason: dto.reason ?? null },
      });
      if (count === 0) throw conflict('REQUEST_ALREADY_DECIDED', 'Este pedido já foi decidido.');

      // A versão pública só é gravada na aprovação.
      if (request.professionalId) {
        const professional = await tx.professional.findUniqueOrThrow({ where: { id: request.professionalId } });
        await tx.professional.update({
          where: { id: professional.id },
          data: {
            verificationStatus: outcome,
            ...(outcome === 'APPROVED' ? { publicProfile: this.professionals.buildPublicProfile(professional) } : {}),
          },
        });
      } else {
        const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: request.clinicId! } });
        await tx.clinic.update({
          where: { id: clinic.id },
          data: {
            verificationStatus: outcome,
            ...(outcome === 'APPROVED' ? { publicProfile: this.clinics.buildPublicProfile(clinic) } : {}),
          },
        });
      }

      await this.audit.record(
        {
          actorId: adminId,
          action: `VERIFICATION_${outcome}`,
          entityType: 'VerificationRequest',
          entityId: requestId,
          metadata: {
            target: request.target,
            subjectId: request.professionalId ?? request.clinicId,
            reason: dto.reason ?? null,
          },
        },
        tx,
      );

      if (ownerUserId) {
        await this.outbox.emitOutbox(
          {
            type: 'VERIFICATION_DECIDED',
            dedupKey: `verification:${requestId}:decided`,
            payload: { userId: ownerUserId, target: request.target, decision: outcome, reason: dto.reason ?? null },
          },
          tx,
        );
      }
      return this.requestView(await tx.verificationRequest.findUniqueOrThrow({ where: { id: requestId } }));
    });
  }

  async suspend(adminId: string, kind: 'professionals' | 'clinics', id: string, reason: string) {
    return this.changeProviderStatus(adminId, kind, id, reason, 'SUSPENDED', [
      'APPROVED',
      'PENDING',
      'CHANGES_REQUESTED',
      'REJECTED',
    ]);
  }

  /** Reativa um perfil suspenso: volta como aprovado se já teve versão pública, senão como pendente. */
  async reinstate(adminId: string, kind: 'professionals' | 'clinics', id: string, reason: string) {
    return this.changeProviderStatus(adminId, kind, id, reason, 'REINSTATE', ['SUSPENDED']);
  }

  async listAudit(query: AuditQuery) {
    const [items, total] = await this.audit.list(
      { entityType: query.entityType, entityId: query.entityId },
      query.skip,
      query.limit,
    );
    return paginated(items, query.page, query.limit, total);
  }

  private async changeProviderStatus(
    adminId: string,
    kind: 'professionals' | 'clinics',
    id: string,
    reason: string,
    target: 'SUSPENDED' | 'REINSTATE',
    allowedFrom: string[],
  ) {
    const isProfessional = kind === 'professionals';
    const entity = isProfessional
      ? await this.prisma.professional.findUnique({ where: { id } })
      : await this.prisma.clinic.findUnique({ where: { id } });
    if (!entity) throw notFound('PROVIDER_NOT_FOUND', 'Cadastro não encontrado.');
    if (!allowedFrom.includes(entity.verificationStatus)) {
      throw conflict('INVALID_STATE', 'O estado atual do cadastro não permite essa operação.');
    }
    const status = target === 'SUSPENDED' ? 'SUSPENDED' : entity.publicProfile ? 'APPROVED' : 'PENDING';
    const ownerUserId = isProfessional
      ? (entity as { userId: string }).userId
      : (entity as { ownerId: string | null }).ownerId;

    await this.prisma.$transaction(async (tx) => {
      if (isProfessional) await tx.professional.update({ where: { id }, data: { verificationStatus: status } });
      else await tx.clinic.update({ where: { id }, data: { verificationStatus: status } });

      await this.audit.record(
        {
          actorId: adminId,
          action: target === 'SUSPENDED' ? 'PROVIDER_SUSPENDED' : 'PROVIDER_REINSTATED',
          entityType: isProfessional ? 'Professional' : 'Clinic',
          entityId: id,
          // O nome vai junto para o painel listar os suspensos sem outra consulta.
          metadata: {
            reason,
            name: isProfessional ? (entity as { displayName: string }).displayName : (entity as { name: string }).name,
          },
        },
        tx,
      );
      if (ownerUserId) {
        await this.outbox.emitOutbox(
          {
            type: 'VERIFICATION_DECIDED',
            payload: {
              userId: ownerUserId,
              target: isProfessional ? 'PROFESSIONAL' : 'CLINIC',
              decision: status === 'SUSPENDED' ? 'SUSPENDED' : status,
              reason,
            },
          },
          tx,
        );
      }
    });
    return { id, verificationStatus: status };
  }

  private async requireRequest(id: string) {
    const request = await this.prisma.verificationRequest.findUnique({ where: { id } });
    if (!request) throw notFound('VERIFICATION_REQUEST_NOT_FOUND', 'Pedido de verificação não encontrado.');
    return request;
  }

  private async subjectsFor(requests: VerificationRequest[]) {
    const professionalIds = requests.map((r) => r.professionalId).filter((v): v is string => !!v);
    const clinicIds = requests.map((r) => r.clinicId).filter((v): v is string => !!v);
    const [professionals, clinics] = await Promise.all([
      professionalIds.length
        ? this.prisma.professional.findMany({
            where: { id: { in: professionalIds } },
            select: {
              id: true,
              displayName: true,
              crmvNumber: true,
              crmvState: true,
              city: true,
              verificationStatus: true,
            },
          })
        : [],
      clinicIds.length
        ? this.prisma.clinic.findMany({
            where: { id: { in: clinicIds } },
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              responsibleVet: true,
              responsibleCrmv: true,
              verificationStatus: true,
            },
          })
        : [],
    ]);
    const byId = new Map<string, unknown>();
    professionals.forEach((p) =>
      byId.set(p.id, {
        kind: 'PROFESSIONAL',
        name: p.displayName,
        crmv: `${p.crmvNumber}/${p.crmvState}`,
        city: p.city,
        verificationStatus: p.verificationStatus,
      }),
    );
    clinics.forEach((c) =>
      byId.set(c.id, {
        kind: 'CLINIC',
        name: c.name,
        city: c.city,
        state: c.state,
        responsibleVet: c.responsibleVet,
        responsibleCrmv: c.responsibleCrmv,
        verificationStatus: c.verificationStatus,
      }),
    );
    return new Map(requests.map((r) => [r.id, byId.get((r.professionalId ?? r.clinicId)!)]));
  }

  private requestView(r: VerificationRequest) {
    return {
      id: r.id,
      target: r.target,
      status: r.status,
      professionalId: r.professionalId,
      clinicId: r.clinicId,
      decidedById: r.decidedById,
      decidedAt: r.decidedAt,
      reason: r.reason,
      createdAt: r.createdAt,
    };
  }
}
