import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportPreview, ImportResult } from '@crm/shared';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { BulkClientsDto } from './dto/bulk-clients.dto';
import { ClientsImportService } from './import/clients-import.service';
import { ImportClientsDto } from './import/import.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';

/** Модуль управления клиентами (ТЗ п. 1.2.1). */
@Controller('clients')
@AuditEntity('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly importService: ClientsImportService,
  ) {}

  /**
   * Предпросмотр загружаемого файла.
   *
   * В базу не пишется ничего: пользователь сначала видит, что именно
   * будет создано и какие строки отбракованы, и только потом решает.
   */
  @Post('import/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      // Предел отдельный от предела тела запроса: файл на тысячу строк
      // крупнее любой формы, но не безразмерный
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async importPreview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<ImportPreview> {
    this.importService.assertCanImport(user);
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }
    if (!/\.(csv|xlsx)$/i.test(file.originalname)) {
      throw new BadRequestException('Поддерживаются файлы CSV и XLSX');
    }
    return this.importService.preview(file.buffer, file.originalname, user);
  }

  /** Загрузка отобранных строк. */
  @Post('import')
  importClients(
    @Body() dto: ImportClientsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ImportResult> {
    this.importService.assertCanImport(user);
    return this.importService.import(
      dto.rows.map((row) => ({
        line: row.line,
        name: row.name,
        inn: row.inn ?? null,
        industry: row.industry ?? null,
        status: row.status ?? null,
        source: row.source ?? null,
        address: row.address ?? null,
        errors: [],
      })),
      user,
    );
  }

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

  /**
   * Массовая правка выбранных карточек.
   *
   * Отдельный маршрут, а не повторение PATCH по одной: у операции свои
   * правила — доступ проверяется ко всем записям сразу, и при отказе
   * не меняется ни одна.
   */
  @Patch('bulk')
  bulkUpdate(@Body() dto: BulkClientsDto, @CurrentUser() user: AuthUser) {
    return this.clientsService.bulkUpdate(dto, user);
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
