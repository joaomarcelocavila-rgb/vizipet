import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

export class CreateAppointmentDto {
  @IsUUID() petId: string;
  @IsUUID() serviceId: string;
  @IsUUID() professionalId: string;
  @IsOptional() @IsUUID() clinicId?: string;
  @IsUUID() slotId: string;
}

export enum AppointmentScope {
  UPCOMING = 'upcoming',
  PAST = 'past',
  CANCELLED = 'cancelled',
}

export class ListAppointmentsQuery extends PaginationQuery {
  @IsEnum(AppointmentScope)
  scope: AppointmentScope = AppointmentScope.UPCOMING;
}

export class CancelAppointmentDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}
