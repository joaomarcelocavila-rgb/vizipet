import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { ListNotificationsQuery } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificações')
@Controller('notifications')
@Protected()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Central de notificações do usuário (meta.unread traz o total não lido)' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsQuery) {
    return this.notifications.list(user.id, query);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIdPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
