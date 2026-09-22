import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';
import { Offer } from '../offers/offer.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Deal, Activity, Offer])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
