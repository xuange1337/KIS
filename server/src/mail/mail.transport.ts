/** Готовое к отправке письмо. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Способ доставки писем.
 *
 * Выделен в интерфейс, чтобы тесты подменяли доставку на память, а
 * развёртывание без почтового сервера продолжало работать: в нём
 * приглашения и ссылки передаются из рук в руки, как раньше.
 */
export interface MailTransport {
  /** Доставка настроена; без неё send вызывать не нужно. */
  readonly enabled: boolean;
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
