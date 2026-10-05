import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

export class ListNotificationsQuery extends PaginationQuery {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread?: boolean;
}
