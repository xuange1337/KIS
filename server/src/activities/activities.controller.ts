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
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CompleteActivityDto } from './dto/complete-activity.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';

/** Модуль активностей: планирование звонков, встреч и писем (ТЗ п. 1.2.4). */
@Controller('activities')
@AuditEntity('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(@Query() query: QueryActivitiesDto, @CurrentUser() user: AuthUser) {
    return this.activitiesService.findAll(query, user);
  }

  /** Данные для календаря/планировщика за период. */
  @Get('calendar')
  findForCalendar(
    @Query() query: QueryActivitiesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.activitiesService.findForCalendar(query, user);
  }

  @Get('overdue')
  findOverdue(@CurrentUser() user: AuthUser) {
    return this.activitiesService.findOverdue(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.activitiesService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateActivityDto, @CurrentUser() user: AuthUser) {
    return this.activitiesService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.activitiesService.update(id, dto, user);
  }

  @Patch(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.activitiesService.complete(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.activitiesService.remove(id, user);
  }
}
