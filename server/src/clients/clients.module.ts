import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { UsersModule } from '../users/users.module';
import { ClientsImportService } from './import/clients-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client]), UsersModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsImportService],
  exports: [ClientsService],
})
export class ClientsModule {}
