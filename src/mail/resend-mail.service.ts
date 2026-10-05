import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { MailMessage, MailService } from './mail.service';

@Injectable()
export class ResendMailService extends MailService {
  private readonly logger = new Logger('Mail');

  constructor(private readonly config: AppConfig) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    const apiKey = this.config.get('RESEND_API_KEY');
    if (!apiKey) {
      // Sem chave (desenvolvimento): não envia e não registra destinatário nem conteúdo.
      this.logger.log(`E-mail "${message.subject}" não enviado: RESEND_API_KEY ausente.`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.config.get('MAIL_FROM'),
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!res.ok) throw new Error(`Provedor de e-mail respondeu ${res.status}`);
  }
}
