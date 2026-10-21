import { createTransport, Transporter } from 'nodemailer';
import { AppConfig } from '../config/configuration';
import { MailMessage, MailTransport } from './mail.transport';

/** Доставка через SMTP-сервер организации-оператора. */
export class SmtpTransport implements MailTransport {
  readonly enabled: boolean;
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: AppConfig['mail']) {
    this.enabled = Boolean(config.host);
    this.from = config.from;
    this.transporter = this.enabled
      ? createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.user
            ? { user: config.user, pass: config.password }
            : undefined,
          // Почтовый сервер не должен подвешивать запрос пользователя
          connectionTimeout: 10_000,
          socketTimeout: 15_000,
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
