import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@crm/shared';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { DiagnosticsService, DiagnosticsSummary } from './diagnostics.service';

/** Диагностика экземпляра — только для администратора. */
@Controller('diagnostics')
@Roles(UserRole.ADMIN)
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get()
  summary(@CurrentUser() user: AuthUser): Promise<DiagnosticsSummary> {
    return this.diagnostics.summary(user);
  }
}
