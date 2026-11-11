import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { Deal } from '../deals/deal.entity';
import { Favorite } from './favorite.entity';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';
import { SavedFilter } from './saved-filter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavedFilter, Favorite, Client, Deal])],
  controllers: [PersonalController],
  providers: [PersonalService],
})
export class PersonalModule {}
