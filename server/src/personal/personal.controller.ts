import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  CreateSavedFilterDto,
  FavoriteType,
  QueryFavoritesDto,
  QuerySavedFiltersDto,
} from './personal.dto';
import { PersonalService } from './personal.service';

const FAVORITE_TYPE_PIPE = new ParseEnumPipe({
  client: 'client',
  deal: 'deal',
});

/** Личные настройки пользователя: сохранённые фильтры и избранное. */
@Controller()
export class PersonalController {
  constructor(private readonly service: PersonalService) {}

  @Get('saved-filters')
  listFilters(
    @Query() query: QuerySavedFiltersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.listFilters(query.entity, user);
  }

  @Post('saved-filters')
  createFilter(
    @Body() dto: CreateSavedFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createFilter(dto, user);
  }

  @Delete('saved-filters/:id')
  removeFilter(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeFilter(id, user);
  }

  @Get('favorites')
  listFavorites(
    @Query() query: QueryFavoritesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.listFavorites(query.entityType, user);
  }

  @Put('favorites/:type/:id')
  addFavorite(
    @Param('type', FAVORITE_TYPE_PIPE) type: FavoriteType,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addFavorite(type, id, user);
  }

  @Delete('favorites/:type/:id')
  removeFavorite(
    @Param('type', FAVORITE_TYPE_PIPE) type: FavoriteType,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeFavorite(type, id, user);
  }
}
