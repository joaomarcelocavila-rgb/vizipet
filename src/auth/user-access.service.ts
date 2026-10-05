import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';

/**
 * Contrato do bloco do José: assertUserActive(userId).
 * Implementação mínima para destravar os módulos do Pedro e do Guilherme;
 * ao integrar o AuthModule real, esta classe é substituída mantendo a assinatura.
 */
@Injectable()
export class UserAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertUserActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) throw new AppException(401, 'UNAUTHORIZED', 'Sessão inválida.');
    if (user.status !== 'ACTIVE') throw new AppException(403, 'USER_BLOCKED', 'Conta indisponível.');
  }
}
