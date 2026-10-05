import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { AppointmentsService } from './appointments.service';
import { CancelAppointmentDto, CreateAppointmentDto, ListAppointmentsQuery } from './dto/appointment.dto';

@ApiTags('Agendamentos')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @Protected('TUTOR')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'De 8 a 128 caracteres. Repetir a chave devolve o mesmo agendamento.',
  })
  @ApiOperation({ summary: 'Cria e confirma automaticamente um agendamento' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointments.create(user, key, dto);
  }

  @Get()
  @Protected('TUTOR', 'PROFESSIONAL')
  @ApiOperation({ summary: 'Agenda do usuário (scope=upcoming|past|cancelled)' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAppointmentsQuery) {
    return this.appointments.list(user, query);
  }

  @Get(':id')
  @Protected('TUTOR', 'PROFESSIONAL')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.appointments.get(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Protected('TUTOR', 'PROFESSIONAL')
  @ApiOperation({ summary: 'Cancela e libera o horário. O profissional precisa informar o motivo.' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointments.cancel(user, id, dto);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @Protected('PROFESSIONAL')
  @ApiOperation({ summary: 'Marca como concluída, após o horário de início' })
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.appointments.complete(user, id);
  }
}
