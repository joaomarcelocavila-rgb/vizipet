import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export enum ModalityDto {
  IN_PERSON = 'IN_PERSON',
  REMOTE = 'REMOTE',
}

export class CreateServiceDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(ModalityDto)
  modality: ModalityDto;

  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  priceCents?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  speciesIds: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  professionalIds?: string[];
}

export class UpdateServiceDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(ModalityDto)
  modality?: ModalityDto;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  priceCents?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  speciesIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  professionalIds?: string[];
}
