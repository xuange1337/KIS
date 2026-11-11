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
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';
import {
  CreateChecklistItemDto,
  CreateCommentDto,
  QueryRecordDto,
  UpdateChecklistItemDto,
} from './collab.dto';
import { CollabService } from './collab.service';

@Controller()
@AuditEntity('collab')
export class CollabController {
  constructor(private readonly service: CollabService) {}

  @Get('comments')
  listComments(@Query() q: QueryRecordDto, @CurrentUser() user: AuthUser) {
    return this.service.listComments(q.entityType, q.entityId, user);
  }

  @Post('comments')
  addComment(@Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser) {
    return this.service.addComment(
      dto.entityType,
      dto.entityId,
      dto.body,
      user,
    );
  }

  @Delete('comments/:id')
  removeComment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeComment(id, user);
  }

  @Get('checklist')
  listItems(@Query() q: QueryRecordDto, @CurrentUser() user: AuthUser) {
    return this.service.listItems(q.entityType, q.entityId, user);
  }

  @Post('checklist')
  addItem(@Body() dto: CreateChecklistItemDto, @CurrentUser() user: AuthUser) {
    return this.service.addItem(dto.entityType, dto.entityId, dto.text, user);
  }

  @Patch('checklist/:id')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateItem(id, dto, user);
  }

  @Delete('checklist/:id')
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeItem(id, user);
  }
}
