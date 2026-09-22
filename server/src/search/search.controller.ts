import { Controller, Get, Query } from '@nestjs/common';
import { GlobalSearchResult } from '@crm/shared';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

/** Поиск по всем разделам сразу. */
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query() query: SearchQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<GlobalSearchResult> {
    return this.searchService.search(query.q, user);
  }
}
