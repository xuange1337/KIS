import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { OrganizationStatus } from '@crm/shared';
import { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Что разрешено организации в состоянии «приостановлена» помимо чтения.
 *
 * Данные заказчика не удерживаются за неуплату: он должен иметь
 * возможность выгрузить их и сменить сеанс или организацию. Всё
 * остальное, что меняет данные, закрыто.
 */
const ALLOWED_WHEN_SUSPENDED: RegExp[] = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/reports\/[^/]+\/export(\/|$)/,
  // Выйти из организации и закрыть её можно и без оплаты
  /^\/api\/organizations\/current\/(leave|close)$/,
];

const ALLOWED_WHEN_CLOSED: RegExp[] = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/organizations\/current\/reopen$/,
];

/**
 * Запрет записи для приостановленных организаций.
 *
 * Состояние вычисляется в JwtStrategy, поэтому окончание пробного периода
 * вступает в силу немедленно, без фонового задания.
 */
@Injectable()
export class OrganizationStateGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const status = request.user?.organizationStatus;
    if (
      status !== OrganizationStatus.SUSPENDED &&
      status !== OrganizationStatus.CLOSED
    ) {
      return true;
    }
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }
    const path = (request.originalUrl ?? request.url).split('?')[0];
    if (
      status === OrganizationStatus.SUSPENDED &&
      ALLOWED_WHEN_SUSPENDED.some((pattern) => pattern.test(path))
    ) {
      return true;
    }
    // Закрытую организацию можно только вернуть; сменить сеанс и выйти — тоже
    if (
      status === OrganizationStatus.CLOSED &&
      ALLOWED_WHEN_CLOSED.some((pattern) => pattern.test(path))
    ) {
      return true;
    }
    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message:
          status === OrganizationStatus.CLOSED
            ? 'Организация закрыта'
            : 'Доступ организации ограничен: данные доступны только для чтения и выгрузки',
        code: 'ORGANIZATION_SUSPENDED',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
