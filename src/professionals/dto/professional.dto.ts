import { Transform } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { BRAZILIAN_STATES } from '../../common/dto/ufs';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class CreateProfessionalDto {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  displayName: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @Transform(trim)
  @Matches(/^\d{3,10}$/, { message: 'crmvNumber deve conter de 3 a 10 dígitos' })
  crmvNumber: string;

  @Transform(upper)
  @IsIn(BRAZILIAN_STATES)
  crmvState: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  neighborhood?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}

export class UpdateProfessionalDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  displayName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{3,10}$/, { message: 'crmvNumber deve conter de 3 a 10 dígitos' })
  crmvNumber?: string;

  @IsOptional()
  @Transform(upper)
  @IsIn(BRAZILIAN_STATES)
  crmvState?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  neighborhood?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
