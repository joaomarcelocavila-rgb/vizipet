import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/app-exception';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) {
      throw new AppException(403, 'ACCESS_DENIED', 'Você não tem permissão para esta operação.');
    }
    return true;
  }
}
