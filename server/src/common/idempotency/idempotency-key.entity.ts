import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Выполненная операция, помеченная ключом идемпотентности.
 *
 * Хранится результат, а не только факт: повтор должен вернуть тот же
 * ответ, что и первая попытка, иначе клиент, не получивший ответ из-за
 * обрыва связи, не сможет узнать, что именно было создано.
 */
@Entity('idempotency_keys')
@Index('idx_idempotency_user_key', ['userId', 'key'], { unique: true })
export class IdempotencyKey {
  @PrimaryGeneratedColumn({ name: 'idempotency_id' })
  idempotencyId: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  key: string;

  /** Ключ действует в пределах учётной записи, а не глобально. */
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  /** Метод и путь: один ключ не должен переиспользоваться на другом маршруте. */
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  /** Хеш тела запроса: тот же ключ с другими данными — ошибка клиента. */
  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  /** NULL, пока первая попытка ещё выполняется. */
  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'jsonb', nullable: true })
  response: Record<string, unknown> | null;

  @Index('idx_idempotency_created')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
