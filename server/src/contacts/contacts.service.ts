import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ClientsService } from '../clients/clients.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Модуль контактов (ТЗ п. 1.2.2).
 * Права на контакт определяются правами на его клиента, поэтому каждая
 * операция сначала проверяет доступ через ClientsService.findOne().
 */
@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly repo: Repository<Contact>,
    private readonly clientsService: ClientsService,
  ) {}

  async findByClient(clientId: number, user: AuthUser): Promise<Contact[]> {
    await this.clientsService.findOne(clientId, user);
    return this.repo.find({
      where: { clientId },
      order: { fullName: 'ASC' },
    });
  }

  async findOne(contactId: number, user: AuthUser): Promise<Contact> {
    const contact = await this.repo.findOne({
      where: { contactId, organizationId: user.organizationId },
    });
    if (!contact) {
      throw new NotFoundException('Контактное лицо не найдено');
    }
    await this.clientsService.findOne(contact.clientId, user);
    return contact;
  }

  async create(dto: CreateContactDto, user: AuthUser): Promise<Contact> {
    await this.clientsService.findOne(dto.clientId, user);
    return this.repo.save(
      this.repo.create({ ...dto, organizationId: user.organizationId }),
    );
  }

  async update(
    contactId: number,
    dto: UpdateContactDto,
    user: AuthUser,
  ): Promise<Contact> {
    const contact = await this.findOne(contactId, user);
    Object.assign(contact, dto);
    return this.repo.save(contact);
  }

  async remove(contactId: number, user: AuthUser): Promise<{ success: true }> {
    const contact = await this.findOne(contactId, user);
    await this.repo.remove(contact);
    return { success: true };
  }
}
