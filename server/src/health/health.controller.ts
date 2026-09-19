import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Готовность принимать трафик.
   *
   * Кроме доступности базы проверяется и её версия: с непримененными
   * миграциями экземпляр отвечать не должен, иначе балансировщик
   * отправит на него запросы, которые упадут на отсутствующих колонках.
   */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; database: 'up'; schema: 'current' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('База данных недоступна');
    }

    if (await this.dataSource.showMigrations()) {
      throw new ServiceUnavailableException(
        'Схема базы данных старше кода: есть непримененные миграции',
      );
    }
    return { status: 'ok', database: 'up', schema: 'current' };
  }
}
