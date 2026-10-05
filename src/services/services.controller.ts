import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { ServicesService } from './services.service';

@ApiTags('Serviços')
@Controller()
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get('species')
  @ApiOperation({ summary: 'Espécies aceitas pela plataforma (público)' })
  species() {
    return this.services.listSpecies();
  }

  @Post('services')
  @Protected('PROFESSIONAL')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateServiceDto) {
    return this.services.create(user.id, dto);
  }

  @Get('services/mine')
  @Protected('PROFESSIONAL')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.services.listMine(user.id);
  }

  @Get('services/:id')
  @Protected('PROFESSIONAL')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.services.getOwned(id, user.id);
  }

  @Patch('services/:id')
  @Protected('PROFESSIONAL')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, user.id, dto);
  }

  @Delete('services/:id')
  @Protected('PROFESSIONAL')
  @ApiOperation({ summary: 'Desativa o serviço e bloqueia horários livres futuros' })
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.services.deactivate(id, user.id);
  }
}
