import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  InvitationDto,
  InvitationPreview,
  OrganizationDto,
  UserRole,
} from '@crm/shared';
import { OrganizationsService } from './organizations.service';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  JoinByInvitationDto,
  RenameOrganizationDto,
} from './dto/organization.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

/** Своя организация и приглашения в неё. */
@Controller('organizations')
@AuditEntity('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  /** Организация текущего сеанса. */
  @Get('current')
  current(@CurrentUser() user: AuthUser): Promise<OrganizationDto> {
    return this.organizations.findOne(user.organizationId);
  }

  @Patch('current')
  @Roles(UserRole.ADMIN)
  rename(
    @Body() dto: RenameOrganizationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<OrganizationDto> {
    return this.organizations.rename(user.organizationId, dto.name);
  }

  @Get('current/invitations')
  @Roles(UserRole.ADMIN)
  listInvitations(@CurrentUser() user: AuthUser): Promise<InvitationDto[]> {
    return this.organizations.listInvitations(user.organizationId);
  }

  /**
   * Приглашение сотрудника.
   *
   * Возвращает ссылку всегда: почты в развёртывании может не быть или
   * письмо может не дойти, и тогда администратор передаёт её сам.
   * Если указан адрес и почта настроена, ссылка дополнительно уходит
   * письмом (`emailed`).
   */
  @Post('current/invitations')
  @Roles(UserRole.ADMIN)
  invite(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ token: string; expiresAt: string; emailed: boolean }> {
    return this.organizations.invite(
      user.organizationId,
      dto.role,
      dto.fullName?.trim() || null,
      user.userId,
      dto.email?.trim().toLowerCase() || null,
      user.fullName,
    );
  }

  @Delete('current/invitations/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param('id', ParseIntPipe) invitationId: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.organizations.revokeInvitation(
      user.organizationId,
      invitationId,
    );
  }
}

/**
 * Работа с приглашением со стороны приглашённого.
 *
 * Маршруты открытые: по ссылке приходит человек, которого в системе
 * ещё нет.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Public()
  @Get()
  preview(@Query('token') token: string): Promise<InvitationPreview> {
    return this.organizations.preview(token ?? '');
  }

  /** Принятие с заведением новой учётной записи. */
  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Body() dto: AcceptInvitationDto,
  ): Promise<{ organizationId: number }> {
    return this.organizations.acceptAsNewUser(
      dto.token,
      dto.login,
      dto.password,
      dto.fullName.trim(),
    );
  }

  /**
   * Присоединение к организации уже работающим в системе человеком:
   * так партнёр получает доступ ко второму заказчику.
   */
  @Post('join')
  @HttpCode(HttpStatus.OK)
  join(
    @Body() dto: JoinByInvitationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ organizationId: number }> {
    return this.organizations.acceptAsExistingUser(dto.token, user.userId);
  }
}
