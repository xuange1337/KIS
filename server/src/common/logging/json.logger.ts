import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { currentRequestContext } from './request-context';

/**
 * Логгер production-режима: одна строка JSON на событие.
 *
 * Текстовый вывод Nest читается человеком, но не разбирается сборщиком
 * логов: в нём нет ни уровня отдельным полем, ни идентификатора запроса,
 * ни пользователя, поэтому инцидент нельзя собрать по цепочке запроса.
 * В разработке остаётся обычный человекочитаемый вывод.
 */
export class JsonLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
  ): void {
    const requestContext = currentRequestContext();
    for (const message of messages) {
      const record: Record<string, unknown> = {
        time: new Date().toISOString(),
        level: logLevel,
        context: context || undefined,
        requestId: requestContext?.requestId,
        userId: requestContext?.userId,
        message: this.stringify(message),
      };
      const line = JSON.stringify(record);
      if (logLevel === 'error' || logLevel === 'fatal') {
        process.stderr.write(`${line}\n`);
      } else {
        process.stdout.write(`${line}\n`);
      }
    }
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return `${message.name}: ${message.message}`;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
