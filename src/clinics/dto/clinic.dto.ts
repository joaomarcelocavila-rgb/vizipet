import { Transform } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { BRAZILIAN_STATES } from '../../common/dto/ufs';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class CreateClinicDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^[0-9()+\-\s]{8,20}$/, { message: 'phone inválido' })
  phone?: string;

  @Transform(trim)
  @IsString()
  @Length(3, 200)
  addressLine: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80)
  neighborhood: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80)
  city: string;

  @Transform(upper)
  @IsIn(BRAZILIAN_STATES)
  state: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  responsibleVet?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{3,10}\/[A-Za-z]{2}$/, { message: 'use o formato 12345/PE' })
  responsibleCrmv?: string;
}

export class UpdateClinicDto {
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
  @Transform(trim)
  @Matches(/^[0-9()+\-\s]{8,20}$/, { message: 'phone inválido' })
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 200)
  addressLine?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  neighborhood?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  city?: string;

  @IsOptional()
  @Transform(upper)
  @IsIn(BRAZILIAN_STATES)
  state?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  responsibleVet?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{3,10}\/[A-Za-z]{2}$/, { message: 'use o formato 12345/PE' })
  responsibleCrmv?: string;
}
