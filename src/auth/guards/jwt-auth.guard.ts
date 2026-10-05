import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { AppException } from '../../common/app-exception';
import type { AuthenticatedUser } from '../authenticated-user';

const ROLES = ['TUTOR', 'PROFESSIONAL', 'ADMIN'];

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new AppException(401, 'UNAUTHORIZED', 'Autenticação ausente ou expirada.');
    }

    try {
      const payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
      if (payload.typ !== 'access' || !isUUID(payload.sub) || !ROLES.includes(payload.role)) {
        throw new Error('payload');
      }
      const user: AuthenticatedUser = { id: payload.sub, role: payload.role, sessionId: payload.sid };
      req.user = user;
      return true;
    } catch {
      throw new AppException(401, 'UNAUTHORIZED', 'Autenticação ausente ou expirada.');
    }
  }
}
