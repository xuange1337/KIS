import {
  Controller,
  Get,
  Header,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { monitorEventLoopDelay } from 'perf_hooks';
import { timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';
import { GaugeSample, renderMetrics } from './metrics.registry';

const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();

const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Метрики для Prometheus.
 *
 * Выдача раскрывает устройство системы (маршруты, нагрузку, число
 * организаций), поэтому закрыта общим секретом: без `METRICS_TOKEN`
 * маршрут не существует, а с ним отвечает только на запрос с токеном.
 * Секрет сравнивается за постоянное время.
 */
@Controller('metrics')
export class MetricsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(
    @Headers('authorization') authorization?: string,
  ): Promise<string> {
    const token = process.env.METRICS_TOKEN;
    if (!token) {
      throw new NotFoundException();
    }
    const supplied = /^Bearer (.+)$/.exec(authorization ?? '')?.[1] ?? '';
    if (!safeEqual(supplied, token)) {
      throw new UnauthorizedException('Требуется токен метрик');
    }

    const gauges: GaugeSample[] = [
      {
        name: 'process_uptime_seconds',
        help: 'Время работы процесса',
        samples: [{ value: process.uptime() }],
      },
      {
        name: 'process_resident_memory_bytes',
        help: 'Резидентная память процесса',
        samples: [{ value: process.memoryUsage().rss }],
      },
      {
        name: 'nodejs_eventloop_lag_p99_seconds',
        help: 'Задержка цикла событий, 99-й процентиль за время работы',
        samples: [{ value: eventLoop.percentile(99) / 1e9 }],
      },
    ];

    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      gauges.push(
        {
          name: 'crm_db_up',
          help: 'База данных отвечает (1) или нет (0)',
          samples: [{ value: 1 }],
        },
        {
          name: 'crm_db_latency_seconds',
          help: 'Задержка простейшего запроса к базе',
          samples: [{ value: (Date.now() - startedAt) / 1000 }],
        },
      );
      const organizations = await this.dataSource.query(
        `SELECT status, count(*)::int AS count FROM organizations GROUP BY status`,
      );
      gauges.push({
        name: 'crm_organizations',
        help: 'Организации по состоянию',
        samples: organizations.map(
          (row: { status: string; count: number }) => ({
            labels: { status: row.status },
            value: row.count,
          }),
        ),
      });
      const [jobs] = await this.dataSource.query(
        `SELECT count(*) FILTER (WHERE status = 'failed')::int AS failed,
                count(*) FILTER (WHERE status IN ('pending', 'running'))::int AS queued
           FROM export_jobs`,
      );
      gauges.push({
        name: 'crm_export_jobs',
        help: 'Фоновые выгрузки по состоянию',
        samples: [
          { labels: { status: 'failed' }, value: jobs.failed },
          { labels: { status: 'queued' }, value: jobs.queued },
        ],
      });
    } catch {
      gauges.push({
        name: 'crm_db_up',
        help: 'База данных отвечает (1) или нет (0)',
        samples: [{ value: 0 }],
      });
    }
    return renderMetrics(gauges);
  }
}
