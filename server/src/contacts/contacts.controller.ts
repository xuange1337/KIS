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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { AuditEntity } from '../common/decorators/audit.decorator';

/** Модуль контактов (ТЗ п. 1.2.2). */
@Controller()
@AuditEntity('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /** Вкладка «Контакты» в карточке клиента. */
  @Get('clients/:clientId/contacts')
  findByClient(
    @Param('clientId', ParseIntPipe) clientId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contactsService.findByClient(clientId, user);
  }

  @Get('contacts/:id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contactsService.findOne(id, user);
  }

  @Post('contacts')
  create(@Body() dto: CreateContactDto, @CurrentUser() user: AuthUser) {
    return this.contactsService.create(dto, user);
  }

  @Patch('contacts/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.contactsService.update(id, dto, user);
  }

  @Delete('contacts/:id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.contactsService.remove(id, user);
  }
}
