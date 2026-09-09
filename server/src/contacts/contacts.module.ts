import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './contact.entity';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contact]), ClientsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
