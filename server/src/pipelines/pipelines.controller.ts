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
import { UserRole } from '@crm/shared';
import { AuditEntity } from '../common/decorators/audit.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePipelineDto, UpdatePipelineDto } from './pipelines.dto';
import { PipelinesService } from './pipelines.service';

@Controller('pipelines')
@AuditEntity('pipelines')
export class PipelinesController {
  constructor(private readonly service: PipelinesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post()
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  create(@Body() dto: CreatePipelineDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.HEAD, UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePipelineDto,
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
