import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Воронка продаж: набор стадий, по которым идёт сделка. */
@Entity('pipelines')
export class Pipeline {
  @PrimaryGeneratedColumn({ name: 'pipeline_id' })
  pipelineId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Воронка, в которую попадают сделки, если не выбрана другая. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
