import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { configuration } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuditLog } from './common/audit-log.entity';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { QueryFailedFilter } from './common/filters/query-failed.filter';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ContactsModule } from './contacts/contacts.module';
import { DealsModule } from './deals/deals.module';
import { ActivitiesModule } from './activities/activities.module';
import { OffersModule } from './offers/offers.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Общий предел частоты запросов; на форме входа он ужесточён
    // отдельным декоратором (см. AuthController)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    TypeOrmModule.forFeature([AuditLog]),
    AuthModule,
    UsersModule,
    ClientsModule,
    ContactsModule,
    DealsModule,
    ActivitiesModule,
    OffersModule,
    ReportsModule,
    DashboardModule,
    DictionariesModule,
  ],
  providers: [
    // Ограничение частоты идёт первым: подбор пароля должен отсекаться
    // до обращения к базе и до вычисления bcrypt-хеша.
    // В e2e-тестах отключается: они выполняют десятки входов подряд,
    // а сам предел проверяется отдельным сьютом throttle.e2e-spec.ts.
    ...(process.env.RATE_LIMIT_DISABLED === 'true'
      ? []
      : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
    // Авторизация обязательна для всех маршрутов, кроме помеченных @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Журналирование изменяющих запросов (ТЗ п. 1.1)
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Ошибки ограничений БД отдаются как ошибки ввода, а не как сбой сервера
    { provide: APP_FILTER, useClass: QueryFailedFilter },
  ],
})
export class AppModule {}
