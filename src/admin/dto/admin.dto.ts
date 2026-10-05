import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export enum ReviewStatusFilter {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  REJECTED = 'REJECTED',
}

export class ListVerificationRequestsQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(ReviewStatusFilter)
  status: ReviewStatusFilter = ReviewStatusFilter.PENDING;
}

export enum Decision {
  APPROVE = 'APPROVE',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
  REJECT = 'REJECT',
}

export class DecisionDto {
  @IsEnum(Decision)
  decision: Decision;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(5, 1000)
  reason?: string;
}

export class ProviderActionDto {
  @Transform(trim)
  @IsString()
  @Length(5, 1000)
  reason: string;
}

export class ProviderParams {
  @IsIn(['professionals', 'clinics']) kind: 'professionals' | 'clinics';
  @IsUUID() id: string;
}

export class AuditQuery extends PaginationQuery {
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsUUID() entityId?: string;
}
