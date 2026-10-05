import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CreateProfessionalDto, UpdateProfessionalDto } from './dto/professional.dto';
import { ProfessionalsService } from './professionals.service';

@ApiTags('Profissionais')
@Controller('professionals')
@Protected('PROFESSIONAL')
export class ProfessionalsController {
  constructor(private readonly professionals: ProfessionalsService) {}

  @Post('me')
  @ApiOperation({ summary: 'Cria o perfil profissional (nasce PENDING e fora da busca)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProfessionalDto) {
    return this.professionals.createMine(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Perfil profissional autenticado' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.professionals.getMine(user.id);
  }

  @Patch('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Atualiza o perfil; alterar CRMV de um perfil aprovado exige nova revisão' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfessionalDto) {
    return this.professionals.updateMine(user.id, dto);
  }
}
