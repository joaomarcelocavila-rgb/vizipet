import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppConfig } from '../config/app-config.service';
import { OutboxProcessor } from '../notifications/outbox.processor';
import { PrismaService } from '../prisma/prisma.service';
import { SourceChecker } from './source-checker';

export const JOB_NAMES = ['outbox', 'reminders', 'campaigns', 'sources', 'all'] as const;
export type JobName = (typeof JOB_NAMES)[number];

/**
 * Todas as rotinas são idempotentes: rodar duas vezes (ou em paralelo) deixa o mesmo estado final.
 * Podem ser acionadas pelo cron externo (endpoint com segredo) ou por um timer interno opcional.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxProcessor,
    private readonly sources: SourceChecker,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  onModuleInit() {
    if (!this.config.get('INTERNAL_JOBS')) return;
    this.timer = setInterval(() => {
      this.run('all').catch(() => this.logger.error('Falha no ciclo interno de jobs.'));
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(name: JobName) {
    switch (name) {
      case 'outbox':
        return { outbox: await this.processOutbox() };
      case 'reminders':
        return { reminders: await this.enqueueReminders() };
      case 'campaigns':
        return { campaigns: await this.endExpiredCampaigns() };
      case 'sources':
        return { sources: await this.checkCampaignSources() };
      case 'all':
        return {
          reminders: await this.enqueueReminders(),
          campaigns: await this.endExpiredCampaigns(),
          outbox: await this.processOutbox(),
        };
    }
  }

  processOutbox() {
    return this.outbox.processBatch(20);
  }

  /**
   * Enfileira o lembrete de 24 h na Outbox. A chave appointment:{id}:reminder:24h é única,
   * então execuções repetidas ou concorrentes não criam um segundo lembrete.
   */
  async enqueueReminders(): Promise<{ enqueued: number }> {
    const enqueued = await this.prisma.$executeRaw`
      INSERT INTO outbox_events (id, type, payload, dedup_key, status, attempts, next_attempt_at, created_at)
      SELECT gen_random_uuid(), 'APPOINTMENT_REMINDER_24H',
             jsonb_build_object(
               'appointmentId', a.id,
               'tutorId', a.tutor_id,
               'startsAt', to_char(a.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
               'serviceName', a.snapshot ->> 'serviceName',
               'professionalName', a.snapshot ->> 'professionalName',
               'petName', a.snapshot ->> 'petName'),
             'appointment:' || a.id || ':reminder:24h', 'PENDING', 0, now(), now()
        FROM appointments a
       WHERE a.status = 'CONFIRMED'
         AND a.starts_at > now()
         AND a.starts_at <= now() + interval '24 hours'
         AND a.starts_at - a.created_at > interval '24 hours'
      ON CONFLICT (dedup_key) DO NOTHING`;
    return { enqueued };
  }

  async endExpiredCampaigns(): Promise<{ ended: number }> {
    const { count } = await this.prisma.campaign.updateMany({
      where: { status: 'PUBLISHED', endsAt: { lt: new Date() } },
      data: { status: 'ENDED' },
    });
    return { ended: count };
  }

  /** Confere as fontes das campanhas publicadas, as menos recentes primeiro. Só sinaliza; a decisão é humana. */
  async checkCampaignSources(limit = 20): Promise<{ checked: number; flagged: number }> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sourceCheckedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: limit,
      select: { id: true, sourceUrl: true, sourceStatus: true },
    });
    let flagged = 0;
    for (const campaign of campaigns) {
      const result = await this.sources.check(campaign.sourceUrl);
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { sourceStatus: result, sourceCheckedAt: new Date() },
      });
      if (result === 'UNREACHABLE' && campaign.sourceStatus !== 'UNREACHABLE') {
        flagged++;
        await this.audit.record({
          actorId: null,
          action: 'CAMPAIGN_SOURCE_FLAGGED',
          entityType: 'Campaign',
          entityId: campaign.id,
        });
      }
    }
    return { checked: campaigns.length, flagged };
  }
}
