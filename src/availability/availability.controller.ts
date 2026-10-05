import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { AvailabilityService } from './availability.service';
import { BatchSlotsDto, CreateSlotDto, ListSlotsQuery } from './dto/availability.dto';

@ApiTags('Disponibilidade')
@Controller('availability')
@Protected('PROFESSIONAL')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um horário. Datas exigem fuso e são gravadas em UTC.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSlotDto) {
    return this.availability.create(user.id, dto);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Gera horários em lote (até 90 dias), usando a duração do serviço' })
  batch(@CurrentUser() user: AuthenticatedUser, @Body() dto: BatchSlotsDto) {
    return this.availability.createBatch(user.id, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: ListSlotsQuery) {
    return this.availability.listMine(user.id, query);
  }

  @Patch(':id/block')
  block(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.availability.block(user.id, id);
  }

  @Patch(':id/unblock')
  unblock(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.availability.unblock(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.availability.remove(user.id, id);
  }
}
