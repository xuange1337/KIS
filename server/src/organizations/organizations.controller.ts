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
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import {
  AuditAction,
  InvitationDto,
  InvitationPreview,
  MemberDto,
  OrganizationDto,
  UserRole,
} from '@crm/shared';
import { OrganizationsService } from './organizations.service';
import { MembersService } from './members.service';
import { ClosureService } from './closure.service';
import {
  AcceptInvitationDto,
  CloseOrganizationDto,
  CreateInvitationDto,
  JoinByInvitationDto,
  RenameOrganizationDto,
  SetMemberRoleDto,
  TransferOwnershipDto,
} from './dto/organization.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Audit, AuditEntity } from '../common/decorators/audit.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

/** Своя организация и приглашения в неё. */
@Controller('organizations')
@AuditEntity('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly members: MembersService,
    private readonly closure: ClosureService,
  ) {}

  @Get('current/members')
  @Roles(UserRole.ADMIN)
  listMembers(@CurrentUser() user: AuthUser): Promise<MemberDto[]> {
    return this.members.list(user.organizationId);
  }

  @Patch('current/members/:userId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async setMemberRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetMemberRoleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.members.setRole(
      user.organizationId,
      userId,
      dto.role,
      user.userId,
    );
  }

  /** Исключение из организации; учётная запись остаётся. */
  @Delete('current/members/:userId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.members.remove(user.organizationId, userId, user.userId);
  }

  /** Выход из организации. Доступен любой роли. */
  @Post('current/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(@CurrentUser() user: AuthUser): Promise<void> {
    await this.members.leave(user.organizationId, user.userId);
  }

  @Post('current/transfer-ownership')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async transferOwnership(
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.members.transferOwnership(
      user.organizationId,
      user.userId,
      dto.userId,
      dto.password,
    );
  }

  /** Все данные организации одним JSON-файлом. */
  @Get('current/export')
  @Roles(UserRole.ADMIN)
  @Audit(AuditAction.EXPORT)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async exportData(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="organization-${user.organizationId}-export.json"`,
    );
    return this.closure.exportData(user.organizationId);
  }

  @Post('current/close')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async close(
    @Body() dto: CloseOrganizationDto,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.closure.close(
      user.organizationId,
      user.userId,
      dto.password,
      dto.confirmName,
    );
  }

  @Post('current/reopen')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reopen(@CurrentUser() user: AuthUser): Promise<void> {
    await this.closure.reopen(user.organizationId, user.userId);
  }

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
