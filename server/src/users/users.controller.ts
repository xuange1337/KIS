import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UserDto, UserRole } from '@crm/shared';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserDto } from './user.mapper';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';

/** Управление пользователями — доступно только администратору (ТЗ п. 2.5). */
@Controller('users')
@Roles(UserRole.ADMIN)
@AuditEntity('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async findAll(@CurrentUser() actor: AuthUser): Promise<UserDto[]> {
    const members = await this.usersService.findAll(actor.organizationId);
    return members.map(({ user, role }) => toUserDto(user, role));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    const user = await this.usersService.findOne(id, actor.organizationId);
    return toUserDto(
      user,
      await this.usersService.roleIn(id, actor.organizationId),
    );
  }

  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    // Администратор заводит пользователей только в своей организации
    const user = await this.usersService.create(dto, actor.organizationId);
    return toUserDto(user, dto.role);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    const user = await this.usersService.update(
      id,
      dto,
      actor.organizationId,
      actor.userId,
    );
    return toUserDto(
      user,
      await this.usersService.roleIn(id, actor.organizationId),
    );
  }

  /**
   * Выдача одноразовой ссылки на установку пароля.
   *
   * Администратор передаёт ссылку сотруднику и сам нового пароля не
   * знает: раньше он придумывал пароль и диктовал его, после чего
   * пароль знали двое, а иногда он оставался в переписке.
   */
  @Post(':id/password-reset')
  async issuePasswordReset(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthUser,
  ): Promise<{ token: string; expiresAt: string }> {
    // Проверка организации: ссылку нельзя выдать чужому сотруднику
    const user = await this.usersService.findOne(id, actor.organizationId);
    return this.authService.issuePasswordReset(user.userId, actor.userId);
  }

  /** Деактивация вместо удаления — на пользователя ссылаются сделки и журнал. */
  @Delete(':id')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    const user = await this.usersService.deactivate(
      id,
      actor.organizationId,
      actor.userId,
    );
    return toUserDto(
      user,
      await this.usersService.roleIn(id, actor.organizationId),
    );
  }
}
