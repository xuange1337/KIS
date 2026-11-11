import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { Deal } from '../deals/deal.entity';
import { ChecklistItem } from './checklist-item.entity';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';
import { Comment } from './comment.entity';
import { RecordAccessService } from './record-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, ChecklistItem, Client, Deal])],
  controllers: [CollabController],
  providers: [CollabService, RecordAccessService],
})
export class CollabModule {}
