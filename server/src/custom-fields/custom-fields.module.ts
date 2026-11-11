import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomFieldDefinition } from './custom-field.entity';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';

/** Глобальный: значения полей проверяют сервисы клиентов и сделок. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CustomFieldDefinition])],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
