import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserAccessService } from '../user-access.service';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private readonly access: UserAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest().user;
    await this.access.assertUserActive(user.id);
    return true;
  }
}
