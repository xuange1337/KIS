import { Controller, Get, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

class PeriodDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

class ForecastDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

/** Расширенная аналитика продаж: прогноз, конверсия, рейтинг менеджеров. */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('forecast')
  forecast(@Query() query: ForecastDto, @CurrentUser() user: AuthUser) {
    return this.service.forecast(user, query.months);
  }

  @Get('conversion')
  conversion(@Query() query: PeriodDto, @CurrentUser() user: AuthUser) {
    return this.service.conversion(user, query.from, query.to);
  }

  @Get('managers')
  managers(@Query() query: PeriodDto, @CurrentUser() user: AuthUser) {
    return this.service.managers(user, query.from, query.to);
  }
}
