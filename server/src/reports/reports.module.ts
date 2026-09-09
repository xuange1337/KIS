import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';
import { Client } from '../clients/client.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ExportService } from './export.service';

@Module({
  imports: [TypeOrmModule.forFeature([Deal, Activity, Client])],
  controllers: [ReportsController],
  providers: [ReportsService, ExportService],
  exports: [ReportsService],
})
export class ReportsModule {}
