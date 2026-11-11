import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UserRole } from '@crm/shared';
import { AuditEntity } from '../common/decorators/audit.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateTagDto,
  SetClientTagsDto,
  TagClientsDto,
  UpdateTagDto,
} from './tags.dto';
import { TagsService } from './tags.service';

@Controller()
@AuditEntity('tags')
export class TagsController {
  constructor(private readonly service: TagsService) {}

  @Get('tags')
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post('tags')
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  create(@Body() dto: CreateTagDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch('tags/:id')
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete('tags/:id')
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Post('tags/:id/clients')
  addToClients(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TagClientsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addToClients(id, dto.clientIds, user);
  }

  @Get('clients/:id/tags')
  forClient(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.forClient(id, user);
  }

  @Put('clients/:id/tags')
  setForClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetClientTagsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setForClient(id, dto.tagIds, user);
  }
}
