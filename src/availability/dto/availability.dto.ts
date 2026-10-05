import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

// Exige deslocamento explícito (Z ou ±hh:mm) para não depender do fuso do servidor.
const WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;
const withOffset = { message: 'informe data e hora com fuso, ex.: 2026-10-20T09:00:00-03:00' };

export class CreateSlotDto {
  @IsUUID() serviceId: string;
  @IsOptional() @IsUUID() clinicId?: string;

  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  startsAt: string;

  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  endsAt: string;
}

export class BatchSlotsDto {
  @IsUUID() serviceId: string;
  @IsOptional() @IsUUID() clinicId?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'use AAAA-MM-DD' })
  fromDate: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'use AAAA-MM-DD' })
  toDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays: number[];

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'use HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'use HH:mm' })
  endTime: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  gapMinutes?: number;

  @IsOptional()
  @IsString()
  timeZone?: string;
}

export enum SlotStatusFilter {
  AVAILABLE = 'AVAILABLE',
  BOOKED = 'BOOKED',
  BLOCKED = 'BLOCKED',
}

export class ListSlotsQuery extends PaginationQuery {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  to?: string;

  @IsOptional()
  @IsEnum(SlotStatusFilter)
  status?: SlotStatusFilter;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
