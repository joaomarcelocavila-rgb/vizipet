import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { ModalityDto } from '../../services/dto/service.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SearchProvidersQuery extends PaginationQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(ModalityDto)
  modality?: ModalityDto;

  @IsOptional()
  @IsUUID()
  speciesId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  neighborhood?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'use AAAA-MM-DD (data no horário de Recife)' })
  date?: string;

  // Coordenadas só participam do cálculo de distância; não são gravadas nem logadas.
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsIn(['availability', 'name', 'distance'])
  sort: 'availability' | 'name' | 'distance' = 'availability';
}

export class SearchClinicsQuery extends PaginationQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  neighborhood?: string;
}

export class PublicSlotsQuery {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
