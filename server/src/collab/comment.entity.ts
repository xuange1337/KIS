import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Комментарий к клиенту или сделке: заметки команды по ходу работы. */
@Entity('comments')
@Index('idx_comments_entity', ['entityType', 'entityId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn({ name: 'comment_id' })
  commentId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ name: 'entity_type', type: 'varchar', length: 16 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'int' })
  entityId: number;

  @Column({ name: 'author_user_id', type: 'int', nullable: true })
  authorUserId: number | null;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
