import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';

class ListNotificationsDto extends PaginationDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  unread?: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Query() query: ListNotificationsDto, @CurrentUser() user: AuthUser) {
    return this.service.list(user, query.unread === 'true', query.limit);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user);
  }

  @Post(':id/read')
  read(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.markRead(id, user);
  }
}
