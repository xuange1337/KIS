import { PreferredChannel } from '@crm/shared';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../clients/client.entity';

/** Контактное лицо клиента (Приложение А, таблица Contacts). */
@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn({ name: 'contact_id' })
  contactId: number;

  @Index('idx_contacts_client')
  @Column({ name: 'client_id', type: 'int' })
  clientId: number;

  @ManyToOne(() => Client, (client) => client.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'full_name', type: 'varchar', length: 160 })
  fullName: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  position: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({
    name: 'preferred_channel',
    type: 'enum',
    enum: PreferredChannel,
    nullable: true,
  })
  preferredChannel: PreferredChannel | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
