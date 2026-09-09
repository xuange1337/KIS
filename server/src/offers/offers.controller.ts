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
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';

/** Модуль коммерческих предложений (ТЗ п. 1.2.5). */
@Controller()
@AuditEntity('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get('offers')
  findAll(@Query() query: QueryOffersDto, @CurrentUser() user: AuthUser) {
    return this.offersService.findAll(query, user);
  }

  /** Вкладка «Коммерческие предложения» в карточке сделки. */
  @Get('deals/:dealId/offers')
  findByDeal(
    @Param('dealId', ParseIntPipe) dealId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.offersService.findByDeal(dealId, user);
  }

  @Get('offers/:id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.offersService.findOne(id, user);
  }

  @Post('offers')
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: AuthUser) {
    return this.offersService.create(dto, user);
  }

  @Patch('offers/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOfferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.offersService.update(id, dto, user);
  }

  @Delete('offers/:id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.offersService.remove(id, user);
  }
}
