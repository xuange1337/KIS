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
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { ChangeStageDto } from './dto/change-stage.dto';
import { QueryDealsDto } from './dto/query-deals.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';

/** Модуль сделок (ТЗ п. 1.2.3). */
@Controller('deals')
@AuditEntity('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  findAll(@Query() query: QueryDealsDto, @CurrentUser() user: AuthUser) {
    return this.dealsService.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dealsService.findOne(id, user);
  }

  /** История изменения стадий — вкладка карточки сделки. */
  @Get(':id/history')
  findHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dealsService.findHistory(id, user);
  }

  @Post()
  create(@Body() dto: CreateDealDto, @CurrentUser() user: AuthUser) {
    return this.dealsService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dealsService.update(id, dto, user);
  }

  /** Перевод сделки по воронке, в том числе перетаскиванием в канбане. */
  @Patch(':id/stage')
  changeStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dealsService.changeStage(id, dto, user);
  }

  /** force=true подтверждает удаление вместе со связанными записями. */
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Query('force') force?: string,
  ) {
    return this.dealsService.remove(id, user, force === 'true');
  }
}
