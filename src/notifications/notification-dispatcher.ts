import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Message,
  appointmentCancelled,
  appointmentConfirmed,
  appointmentReminder,
  passwordReset,
  verificationDecided,
} from './notification-messages';

export class UnknownEventError extends Error {}

interface Delivery {
  userId: string;
  type: string;
  dedupKey: string;
  message: Message;
  /** Eventos de segurança não geram item na central, só e-mail. */
  inApp?: boolean;
}

/** Traduz eventos da Outbox em notificações (central + e-mail), sem duplicar nem em reprocessamento. */
@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async dispatch(event: { id: string; type: string; payload: unknown }): Promise<void> {
    const p = (event.payload ?? {}) as Record<string, unknown>;
    const deliveries = this.plan(event.id, event.type, p);
    for (const delivery of deliveries) await this.deliver(delivery);
  }

  private plan(eventId: string, type: string, p: Record<string, unknown>): Delivery[] {
    const id = String(p.appointmentId ?? eventId);
    switch (type) {
      case 'APPOINTMENT_CONFIRMED':
        return [
          {
            userId: String(p.tutorId),
            type,
            dedupKey: `appointment:${id}:confirmed:${p.tutorId}`,
            message: appointmentConfirmed(p, 'tutor'),
          },
          {
            userId: String(p.professionalUserId),
            type,
            dedupKey: `appointment:${id}:confirmed:${p.professionalUserId}`,
            message: appointmentConfirmed(p, 'professional'),
          },
        ];
      case 'APPOINTMENT_CANCELLED':
        return [
          {
            userId: String(p.notifyUserId),
            type,
            dedupKey: `appointment:${id}:cancelled:${p.notifyUserId}`,
            message: appointmentCancelled(p),
          },
        ];
      case 'APPOINTMENT_REMINDER_24H':
        return [
          {
            userId: String(p.tutorId),
            type,
            dedupKey: `appointment:${id}:reminder:24h:${p.tutorId}`,
            message: appointmentReminder(p),
          },
        ];
      case 'VERIFICATION_DECIDED':
        return [
          { userId: String(p.userId), type, dedupKey: `verification:${eventId}`, message: verificationDecided(p) },
        ];
      case 'PASSWORD_RESET_REQUESTED':
        return [
          {
            userId: String(p.userId),
            type,
            dedupKey: `password-reset:${eventId}`,
            message: passwordReset(p),
            inApp: false,
          },
        ];
      default:
        throw new UnknownEventError(`Evento sem tratamento: ${type}`);
    }
  }

  private async deliver(delivery: Delivery): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: delivery.userId },
      select: { email: true, status: true, notificationPreferences: true },
    });
    if (!user || user.status === 'DELETED') return;

    const { message } = delivery;
    if (delivery.inApp !== false) {
      await this.prisma.notification.createMany({
        data: [
          {
            userId: delivery.userId,
            channel: 'IN_APP',
            type: delivery.type,
            title: message.title,
            body: message.body,
            deduplicationKey: delivery.dedupKey,
          },
        ],
        skipDuplicates: true,
      });
    }

    if (!this.emailAllowed(message.email, user.notificationPreferences)) return;

    // O registro do canal e-mail marca "já enviado"; se o envio falhar, o retry tenta de novo.
    const emailKey = `${delivery.dedupKey}:email`;
    const alreadySent = await this.prisma.notification.findUnique({
      where: { deduplicationKey: emailKey },
      select: { id: true },
    });
    if (alreadySent) return;

    await this.mail.send({ to: user.email, subject: message.title, text: message.body });
    await this.prisma.notification.createMany({
      data: [
        {
          userId: delivery.userId,
          channel: 'EMAIL',
          type: delivery.type,
          title: message.title,
          body: message.title,
          deduplicationKey: emailKey,
        },
      ],
      skipDuplicates: true,
    });
  }

  private emailAllowed(
    kind: Message['email'],
    prefs: { emailEnabled: boolean; appointmentReminders: boolean } | null,
  ): boolean {
    if (kind === 'security') return true;
    const emailEnabled = prefs?.emailEnabled ?? true;
    if (!emailEnabled) return false;
    if (kind === 'reminder') return prefs?.appointmentReminders ?? true;
    return true;
  }
}
