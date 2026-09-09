import { ClientSource, ClientStatus } from '@crm/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Contact } from '../contacts/contact.entity';
import { Deal } from '../deals/deal.entity';
import { Activity } from '../activities/activity.entity';

/** Карточка клиента (Приложение А, таблица Clients). */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn({ name: 'client_id' })
  clientId: number;

  @Index('idx_clients_name')
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  inn: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  industry: string | null;

  @Column({ type: 'enum', enum: ClientStatus, default: ClientStatus.LEAD })
  status: ClientStatus;

  @Column({ type: 'enum', enum: ClientSource, nullable: true })
  source: ClientSource | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  /** Ответственный менеджер — основа разграничения доступа по ролям. */
  @Index('idx_clients_owner')
  @Column({ name: 'owner_user_id', type: 'int', nullable: true })
  ownerUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Contact, (contact) => contact.client)
  contacts: Contact[];

  @OneToMany(() => Deal, (deal) => deal.client)
  deals: Deal[];

  @OneToMany(() => Activity, (activity) => activity.client)
  activities: Activity[];
}
