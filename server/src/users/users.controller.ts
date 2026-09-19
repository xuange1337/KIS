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
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@CurrentUser() actor: AuthUser): Promise<UserDto[]> {
    const users = await this.usersService.findAll(actor.organizationId);
    return users.map(toUserDto);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    return toUserDto(await this.usersService.findOne(id, actor.organizationId));
  }

  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    // Администратор заводит пользователей только в своей организации
    return toUserDto(await this.usersService.create(dto, actor.organizationId));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    return toUserDto(
      await this.usersService.update(
        id,
        dto,
        actor.organizationId,
        actor.userId,
      ),
    );
  }

  /** Деактивация вместо удаления — на пользователя ссылаются сделки и журнал. */
  @Delete(':id')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthUser,
  ): Promise<UserDto> {
    return toUserDto(
      await this.usersService.deactivate(
        id,
        actor.organizationId,
        actor.userId,
      ),
    );
  }
}
