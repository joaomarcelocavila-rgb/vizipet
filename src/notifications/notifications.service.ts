import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { notFound } from '../common/app-exception';
import { paginated } from '../common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQuery } from './dto/notifications.dto';

const select = {
  id: true,
  type: true,
  title: true,
  body: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListNotificationsQuery) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      channel: 'IN_APP',
      ...(query.unread ? { readAt: null } : {}),
    };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, channel: 'IN_APP', readAt: null } }),
    ]);
    const result = paginated(items, query.page, query.limit, total);
    return Object.assign(result, { meta: { ...result.meta, unread } });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, userId, channel: 'IN_APP' }, select });
    if (!notification) throw notFound('NOTIFICATION_NOT_FOUND', 'Notificação não encontrada.');
    if (notification.readAt) return notification;
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() }, select });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }
}
