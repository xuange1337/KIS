import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deal } from './deal.entity';
import { DealStageHistory } from './deal-stage-history.entity';
import { DealItem } from './deal-item.entity';
import { DealItemsService } from './deal-items.service';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { ClientsModule } from '../clients/clients.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deal, DealStageHistory, DealItem]),
    ClientsModule,
    UsersModule,
  ],
  controllers: [DealsController],
  providers: [DealsService, DealItemsService],
  exports: [DealsService],
})
export class DealsModule {}
