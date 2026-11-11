import { DealStage } from '@crm/shared';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Стадия внутри воронки и её порядок. */
@Entity('pipeline_stages')
export class PipelineStage {
  @PrimaryColumn({ name: 'pipeline_id', type: 'int' })
  pipelineId: number;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  stage: DealStage;

  @Column({ type: 'int' })
  position: number;
}
