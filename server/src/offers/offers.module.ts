import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from './offer.entity';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [TypeOrmModule.forFeature([Offer]), DealsModule],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
