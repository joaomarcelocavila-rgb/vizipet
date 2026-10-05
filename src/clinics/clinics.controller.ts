import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto, UpdateClinicDto } from './dto/clinic.dto';

@ApiTags('Clínicas')
@Controller('clinics')
@Protected('PROFESSIONAL')
export class ClinicsController {
  constructor(private readonly clinics: ClinicsService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra clínica (nasce PENDING e fora da busca)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClinicDto) {
    return this.clinics.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Clínicas do usuário autenticado' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.clinics.listMine(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.clinics.getOwned(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza a clínica; alterar dados sensíveis de uma clínica aprovada exige nova revisão' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string, @Body() dto: UpdateClinicDto) {
    return this.clinics.update(id, user.id, dto);
  }

  @Post(':id/professionals/:professionalId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Vincula um profissional à clínica' })
  link(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Param('professionalId', ParseIdPipe) professionalId: string,
  ) {
    return this.clinics.linkProfessional(id, user.id, professionalId);
  }

  @Delete(':id/professionals/:professionalId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove o vínculo de um profissional com a clínica' })
  unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Param('professionalId', ParseIdPipe) professionalId: string,
  ) {
    return this.clinics.unlinkProfessional(id, user.id, professionalId);
  }
}
