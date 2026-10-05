import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ActiveUserGuard } from '../guards/active-user.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import type { Role } from '../authenticated-user';

/** JwtAuthGuard + ActiveUserGuard + RolesGuard, na ordem em que precisam rodar. */
export function Protected(...roles: Role[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.' }),
    ApiForbiddenResponse({ description: 'Papel sem permissão ou conta indisponível.' }),
  );
}
