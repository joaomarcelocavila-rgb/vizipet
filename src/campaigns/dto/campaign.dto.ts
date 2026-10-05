import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { IsPublicHttpsUrl } from '../../common/validators/public-https-url';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;
const withOffset = { message: 'informe data e hora com fuso, ex.: 2026-10-20T09:00:00-03:00' };

export class CreateCampaignDto {
  @Transform(trim) @IsString() @Length(3, 160) title: string;
  @Transform(trim) @IsString() @Length(2, 80) type: string;
  @Transform(trim) @IsString() @Length(2, 160) organization: string;
  @Transform(trim) @IsString() @Length(2, 300) audience: string;
  @Transform(trim) @IsString() @Length(2, 1000) requirements: string;
  @Transform(trim) @IsString() @Length(2, 300) location: string;

  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  startsAt: string;

  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  endsAt: string;

  @Transform(trim)
  @IsPublicHttpsUrl()
  sourceUrl: string;
}

export class UpdateCampaignDto {
  @IsOptional() @Transform(trim) @IsString() @Length(3, 160) title?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80) type?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 160) organization?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 300) audience?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 1000) requirements?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(2, 300) location?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  startsAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(WITH_OFFSET, withOffset)
  endsAt?: string;

  @IsOptional()
  @Transform(trim)
  @IsPublicHttpsUrl()
  sourceUrl?: string;
}

export enum CampaignStatusFilter {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PUBLISHED = 'PUBLISHED',
  ENDED = 'ENDED',
  ARCHIVED = 'ARCHIVED',
}

export class ListCampaignsAdminQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(CampaignStatusFilter)
  status?: CampaignStatusFilter;
}
