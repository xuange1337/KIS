import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';

/** Сводка состояния экземпляра и данных организации. */
export interface DiagnosticsSummary {
  instance: {
    /** Версия приложения из package.json. */
    version: string;
    nodeVersion: string;
    environment: string;
    timeZone: string;
    /** Время работы процесса, секунд. */
    uptimeSeconds: number;
    memoryMb: number;
  };
  database: {
    schemaVersion: string | null;
    /** Задержка простейшего запроса, мс. */
    latencyMs: number;
    /** Размер базы, читаемый человеком. */
    size: string;
    connections: number;
  };
  organization: {
    organizationId: number;
    clients: number;
    deals: number;
    activities: number;
    offers: number;
    users: number;
    activeSessions: number;
    auditRecordsLast24h: number;
  };
}

/**
 * Диагностика для администратора.
 *
 * Без неё единственный способ ответить на вопросы «работает ли», «сколько
 * данных», «когда применялась миграция» — зайти на сервер и открыть psql.
 * Администратор организации такого доступа не имеет и не должен иметь,
 * а вопросы у него те же.
 *
 * Показатели по данным считаются в пределах организации: цифры соседней
 * организации администратору здесь так же недоступны, как и её записи.
 */
@Injectable()
export class DiagnosticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async summary(user: AuthUser): Promise<DiagnosticsSummary> {
    const startedAt = Date.now();
    await this.dataSource.query('SELECT 1');
    const latencyMs = Date.now() - startedAt;

    const [schema] = await this.dataSource.query(
      `SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1`,
    );
    const [size] = await this.dataSource.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
    );
    const [connections] = await this.dataSource.query(
      `SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE datname = current_database()`,
    );

    const organizationId = user.organizationId;
    const [counts] = await this.dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM clients WHERE organization_id = $1) AS clients,
         (SELECT count(*)::int FROM deals WHERE organization_id = $1) AS deals,
         (SELECT count(*)::int FROM activities WHERE organization_id = $1) AS activities,
         (SELECT count(*)::int FROM commercial_offers WHERE organization_id = $1) AS offers,
         (SELECT count(*)::int FROM users WHERE organization_id = $1) AS users,
         (SELECT count(*)::int FROM refresh_sessions s
            JOIN users u ON u.user_id = s.user_id
           WHERE u.organization_id = $1
             AND s.revoked_at IS NULL AND s.expires_at > now()) AS sessions,
         (SELECT count(*)::int FROM audit_log
           WHERE organization_id = $1
             AND created_at > now() - interval '24 hours') AS audit`,
      [organizationId],
    );

    return {
      instance: {
        version: process.env.npm_package_version ?? '1.0.0',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV ?? 'development',
        timeZone: process.env.TZ ?? 'Europe/Moscow',
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      database: {
        schemaVersion: schema?.name ?? null,
        latencyMs,
        size: size.size,
        connections: connections.count,
      },
      organization: {
        organizationId,
        clients: counts.clients,
        deals: counts.deals,
        activities: counts.activities,
        offers: counts.offers,
        users: counts.users,
        activeSessions: counts.sessions,
        auditRecordsLast24h: counts.audit,
      },
    };
  }
}
