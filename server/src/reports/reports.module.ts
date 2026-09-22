import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';
import { Client } from '../clients/client.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ExportService } from './export.service';
import { ExportJob } from './jobs/export-job.entity';
import { ExportJobsService } from './jobs/export-jobs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Deal, Activity, Client, ExportJob])],
  controllers: [ReportsController],
  providers: [ReportsService, ExportService, ExportJobsService],
  exports: [ReportsService],
})
export class ReportsModule {}
