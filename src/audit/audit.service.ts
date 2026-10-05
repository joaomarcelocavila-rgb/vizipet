import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionClient } from '../prisma/types';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Passe `tx` para que o registro entre ou saia junto com a operação auditada. */
  async record(entry: AuditEntry, tx?: TransactionClient): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  }

  list(filter: { entityType?: string; entityId?: string }, skip: number, take: number) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.entityId ? { entityId: filter.entityId } : {}),
    };
    return Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.prisma.auditLog.count({ where }),
    ]);
  }
}
