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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';

/** Модуль управления клиентами (ТЗ п. 1.2.1). */
@Controller('clients')
@AuditEntity('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Query() query: QueryClientsDto, @CurrentUser() user: AuthUser) {
    return this.clientsService.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthUser) {
    return this.clientsService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.update(id, dto, user);
  }

  /** force=true подтверждает удаление вместе со связанными записями. */
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Query('force') force?: string,
  ) {
    return this.clientsService.remove(id, user, force === 'true');
  }
}
