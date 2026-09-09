import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './activity.entity';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { ClientsModule } from '../clients/clients.module';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [TypeOrmModule.forFeature([Activity]), ClientsModule, DealsModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
