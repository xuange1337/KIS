import { Controller, Get } from '@nestjs/common';
import { DashboardSummary } from '@crm/shared';
import { DashboardService } from './dashboard.service';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

/** Главная страница: показатели, уведомления, ближайшие активности (ТЗ п. 2.5). */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  summary(@CurrentUser() user: AuthUser): Promise<DashboardSummary> {
    return this.dashboardService.summary(user);
  }
}
