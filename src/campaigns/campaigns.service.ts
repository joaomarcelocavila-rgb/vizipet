import { Injectable } from '@nestjs/common';
import { Campaign, Prisma } from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/app-exception';
import { paginated } from '../common/interceptors/response-envelope.interceptor';
import { normalizeText } from '../common/utils/text';
import { checkPublicHttpsUrl } from '../common/utils/safe-url';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQuery } from '../common/dto/pagination.dto';
import { CreateCampaignDto, ListCampaignsAdminQuery, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ----- administração -----

  async create(adminId: string, dto: CreateCampaignDto) {
    const period = this.parsePeriod(dto.startsAt, dto.endsAt);
    const created = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: { ...dto, ...period, sourceUrl: this.normalizeUrl(dto.sourceUrl), status: 'DRAFT' },
      });
      await this.audit.record(
        { actorId: adminId, action: 'CAMPAIGN_CREATED', entityType: 'Campaign', entityId: campaign.id },
        tx,
      );
      return campaign;
    });
    return this.withWarnings(created);
  }

  async listAdmin(query: ListCampaignsAdminQuery) {
    const where: Prisma.CampaignWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return paginated(
      items.map((c) => this.adminView(c)),
      query.page,
      query.limit,
      total,
    );
  }

  async getAdmin(id: string) {
    return this.withWarnings(await this.require(id));
  }

  async update(adminId: string, id: string, dto: UpdateCampaignDto) {
    const current = await this.require(id);
    if (current.status === 'ENDED' || current.status === 'ARCHIVED') {
      throw conflict('CAMPAIGN_NOT_EDITABLE', 'Campanhas encerradas ou arquivadas não podem ser editadas.');
    }
    const period =
      dto.startsAt || dto.endsAt
        ? this.parsePeriod(dto.startsAt ?? current.startsAt.toISOString(), dto.endsAt ?? current.endsAt.toISOString())
        : {};
    const { startsAt: _s, endsAt: _e, sourceUrl, ...rest } = dto;

    // Alterar uma campanha publicada tira a verificação: volta para revisão.
    const backToReview = current.status === 'PUBLISHED';
    const updated = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.update({
        where: { id },
        data: {
          ...rest,
          ...period,
          ...(sourceUrl
            ? { sourceUrl: this.normalizeUrl(sourceUrl), sourceStatus: 'NOT_CHECKED', sourceCheckedAt: null }
            : {}),
          ...(backToReview ? { status: 'UNDER_REVIEW', verifiedById: null, verifiedAt: null } : {}),
        },
      });
      await this.audit.record(
        {
          actorId: adminId,
          action: 'CAMPAIGN_UPDATED',
          entityType: 'Campaign',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
        },
        tx,
      );
      return campaign;
    });
    return this.withWarnings(updated);
  }

  async submitForReview(adminId: string, id: string) {
    return this.transition(adminId, id, ['DRAFT'], 'UNDER_REVIEW', 'CAMPAIGN_SUBMITTED');
  }

  async publish(adminId: string, id: string) {
    const current = await this.require(id);
    if (current.sourceStatus === 'UNREACHABLE') {
      throw conflict(
        'CAMPAIGN_SOURCE_INVALID',
        'A fonte oficial está inacessível. Atualize o endereço antes de publicar.',
      );
    }
    if (current.endsAt <= new Date()) {
      throw conflict('CAMPAIGN_PERIOD_ENDED', 'O período da campanha já terminou.');
    }
    return this.transition(adminId, id, ['UNDER_REVIEW'], 'PUBLISHED', 'CAMPAIGN_PUBLISHED', {
      verifiedById: adminId,
      verifiedAt: new Date(),
    });
  }

  async archive(adminId: string, id: string) {
    return this.transition(
      adminId,
      id,
      ['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ENDED'],
      'ARCHIVED',
      'CAMPAIGN_ARCHIVED',
    );
  }

  // ----- consulta pública -----

  async listPublic(query: PaginationQuery) {
    const where = this.publicWhere();
    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return paginated(
      items.map((c) => this.publicView(c)),
      query.page,
      query.limit,
      total,
    );
  }

  async getPublic(id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, ...this.publicWhere() } });
    if (!campaign) throw notFound('CAMPAIGN_NOT_PUBLISHED', 'Campanha não disponível.');
    return this.publicView(campaign);
  }

  // ----- internos -----

  private publicWhere(): Prisma.CampaignWhereInput {
    const now = new Date();
    return { status: 'PUBLISHED', startsAt: { lte: now }, endsAt: { gte: now } };
  }

  private async transition(
    adminId: string,
    id: string,
    from: Campaign['status'][],
    to: Campaign['status'],
    action: string,
    extra: Prisma.CampaignUncheckedUpdateInput = {},
  ) {
    await this.require(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.campaign.updateMany({
        where: { id, status: { in: from } },
        data: { status: to, ...extra },
      });
      if (count === 0)
        throw conflict('CAMPAIGN_INVALID_STATE', 'O estado atual da campanha não permite essa operação.');
      await this.audit.record({ actorId: adminId, action, entityType: 'Campaign', entityId: id }, tx);
      return tx.campaign.findUniqueOrThrow({ where: { id } });
    });
    return this.adminView(updated);
  }

  /** Possível duplicidade: mesmo órgão, título parecido e períodos que se cruzam. Só avisa. */
  private async findPossibleDuplicates(campaign: Campaign): Promise<string[]> {
    const candidates = await this.prisma.campaign.findMany({
      where: {
        id: { not: campaign.id },
        status: { not: 'ARCHIVED' },
        startsAt: { lt: campaign.endsAt },
        endsAt: { gt: campaign.startsAt },
      },
      select: { id: true, title: true, organization: true },
    });
    const title = normalizeText(campaign.title);
    const organization = normalizeText(campaign.organization);
    return candidates
      .filter((c) => normalizeText(c.organization) === organization)
      .filter((c) => {
        const other = normalizeText(c.title);
        return other === title || other.includes(title) || title.includes(other);
      })
      .map((c) => c.id);
  }

  private async withWarnings(campaign: Campaign) {
    const duplicates = await this.findPossibleDuplicates(campaign);
    return {
      ...this.adminView(campaign),
      warnings: duplicates.length ? [{ code: 'POSSIBLE_DUPLICATE', campaignIds: duplicates }] : [],
    };
  }

  private async require(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw notFound('CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
    return campaign;
  }

  private parsePeriod(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw badRequest('INVALID_PERIOD', 'O início da campanha deve ser anterior ao término.');
    }
    return { startsAt: start, endsAt: end };
  }

  private normalizeUrl(raw: string): string {
    const result = checkPublicHttpsUrl(raw);
    if (!result.ok) throw badRequest('INVALID_SOURCE_URL', result.reason);
    return result.url.toString();
  }

  private adminView(c: Campaign) {
    return {
      ...this.publicView(c),
      verifiedById: c.verifiedById,
      sourceCheckedAt: c.sourceCheckedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private publicView(c: Campaign) {
    return {
      id: c.id,
      title: c.title,
      type: c.type,
      organization: c.organization,
      audience: c.audience,
      requirements: c.requirements,
      location: c.location,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      sourceUrl: c.sourceUrl,
      sourceStatus: c.sourceStatus,
      status: c.status,
      verifiedAt: c.verifiedAt,
    };
  }
}
