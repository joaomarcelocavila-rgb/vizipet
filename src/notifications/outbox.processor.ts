import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatcher, UnknownEventError } from './notification-dispatcher';

export const MAX_ATTEMPTS = 5;
const LEASE_MINUTES = 5;
// Espera antes da próxima tentativa, em minutos, indexada pelo número de tentativas já feitas.
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

interface ClaimedEvent {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
}

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  /**
   * Pega um lote com FOR UPDATE SKIP LOCKED, então duas execuções simultâneas nunca
   * recebem o mesmo evento. Eventos presos em PROCESSING voltam quando a trava expira.
   */
  async processBatch(limit = 20): Promise<{ claimed: number; processed: number; failed: number }> {
    const claimed = await this.prisma.$queryRaw<ClaimedEvent[]>`
      UPDATE outbox_events
         SET status = 'PROCESSING',
             attempts = attempts + 1,
             next_attempt_at = now() + make_interval(mins => ${LEASE_MINUTES}::int)
       WHERE id IN (
         SELECT id FROM outbox_events
          WHERE status IN ('PENDING', 'PROCESSING') AND next_attempt_at <= now()
          ORDER BY created_at, id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED)
      RETURNING id, type, payload, attempts`;

    let processed = 0;
    let failed = 0;
    for (const event of claimed) {
      try {
        await this.dispatcher.dispatch(event);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
        });
        processed++;
      } catch (error) {
        failed++;
        await this.registerFailure(event, error);
      }
    }
    return { claimed: claimed.length, processed, failed };
  }

  private async registerFailure(event: ClaimedEvent, error: unknown) {
    const permanent = error instanceof UnknownEventError || event.attempts >= MAX_ATTEMPTS;
    const delay = BACKOFF_MINUTES[Math.min(event.attempts, BACKOFF_MINUTES.length) - 1] ?? 240;
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: permanent ? 'FAILED' : 'PENDING',
        lastError: safeError(error),
        nextAttemptAt: new Date(Date.now() + delay * 60_000),
      },
    });
    this.logger.warn(
      `Evento ${event.id} (${event.type}) falhou na tentativa ${event.attempts}${permanent ? ' e foi encerrado' : ''}`,
    );
  }
}

// Só a classe e uma mensagem curta, sem endereços de e-mail.
function safeError(error: unknown): string {
  if (!(error instanceof Error)) return 'Erro desconhecido';
  return `${error.constructor.name}: ${error.message.replace(/\S+@\S+/g, '[email]')}`.slice(0, 200);
}
