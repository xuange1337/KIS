import { PartialType } from '@nestjs/mapped-types';
import { OmitType } from '@nestjs/mapped-types';
import { CreateContactDto } from './create-contact.dto';

/** Контакт нельзя перенести к другому клиенту — clientId неизменяем. */
export class UpdateContactDto extends PartialType(
  OmitType(CreateContactDto, ['clientId'] as const),
) {}
