import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { TransactionClient } from '../prisma/types';

export interface DomainEvent {
  type: string;
  payload: Prisma.InputJsonObject;
  /** Mesma chave = mesmo evento: a segunda emissão é ignorada. */
  dedupKey?: string;
}

/**
 * Contrato: emitOutbox(event, tx). Sempre chamado dentro da transação da ação principal,
 * para o evento existir se, e somente se, a operação for confirmada.
 */
@Injectable()
export class OutboxService {
  async emitOutbox(event: DomainEvent, tx: TransactionClient): Promise<void> {
    await tx.outboxEvent.createMany({
      data: [{ type: event.type, payload: event.payload, dedupKey: event.dedupKey }],
      skipDuplicates: true,
    });
  }
}
