import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './data-source';
import { SchemaVersionService } from './schema-version.service';

@Module({
  imports: [TypeOrmModule.forRoot(buildDataSourceOptions())],
  providers: [SchemaVersionService],
})
export class DatabaseModule {}
