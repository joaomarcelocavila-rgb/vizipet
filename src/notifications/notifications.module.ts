import { Global, Module } from '@nestjs/common';
import { NotificationDispatcher } from './notification-dispatcher';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { OutboxProcessor } from './outbox.processor';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, OutboxService, OutboxProcessor, NotificationDispatcher],
  exports: [OutboxService, OutboxProcessor],
})
export class NotificationsModule {}
