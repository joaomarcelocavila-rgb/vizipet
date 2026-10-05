import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum VerificationTargetDto {
  PROFESSIONAL = 'PROFESSIONAL',
  CLINIC = 'CLINIC',
}

export enum DocumentKindDto {
  CRMV = 'CRMV',
  IDENTITY = 'IDENTITY',
  CLINIC_LICENSE = 'CLINIC_LICENSE',
  OTHER = 'OTHER',
}

export class UploadDocumentDto {
  @IsEnum(VerificationTargetDto) target: VerificationTargetDto;
  @IsEnum(DocumentKindDto) kind: DocumentKindDto;
  @IsOptional() @IsUUID() clinicId?: string;
}

export class DocumentScopeQuery {
  @IsEnum(VerificationTargetDto) target: VerificationTargetDto;
  @IsOptional() @IsUUID() clinicId?: string;
}

export class SubmitVerificationDto {
  @IsEnum(VerificationTargetDto) target: VerificationTargetDto;
  @IsOptional() @IsUUID() clinicId?: string;
}
