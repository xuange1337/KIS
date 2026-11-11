import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@crm/shared';
import { AuditEntity } from '../common/decorators/audit.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateFieldDto,
  QueryFieldsDto,
  UpdateFieldDto,
} from './custom-fields.dto';
import { CustomFieldsService } from './custom-fields.service';

@Controller('custom-fields')
@AuditEntity('custom_fields')
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get()
  list(@Query() query: QueryFieldsDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query.entity, user.organizationId);
  }

  @Post()
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  create(@Body() dto: CreateFieldDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFieldDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
