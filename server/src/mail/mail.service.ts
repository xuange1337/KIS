import { Inject, Injectable, Logger } from '@nestjs/common';
import { mailSent } from '../metrics/metrics.registry';
import { MAIL_TRANSPORT, MailMessage, MailTransport } from './mail.transport';

/**
 * Отправка писем.
 *
 * Сбой почты не должен ронять бизнес-операцию: приглашение уже создано,
 * и администратор может передать ссылку сам. Поэтому ошибка логируется
 * (без адреса и тела письма), а вызывающий получает признак «не ушло».
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  get enabled(): boolean {
    return this.transport.enabled;
  }

  /** @returns true, если письмо передано почтовому серверу. */
  async send(message: MailMessage): Promise<boolean> {
    if (!this.transport.enabled) {
      return false;
    }
    try {
      await this.transport.send(message);
      mailSent.inc({ result: 'sent' });
      return true;
    } catch (error) {
      mailSent.inc({ result: 'failed' });
      this.logger.error(
        `Не удалось отправить письмо «${message.subject}»: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
