import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { AppException } from '../common/app-exception';
import { AppConfig } from '../config/app-config.service';

@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const received = Buffer.from(String(context.switchToHttp().getRequest().headers['x-cron-secret'] ?? ''));
    const expected = Buffer.from(this.config.get('CRON_SECRET'));
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new AppException(401, 'UNAUTHORIZED', 'Autenticação ausente ou expirada.');
    }
    return true;
  }
}
