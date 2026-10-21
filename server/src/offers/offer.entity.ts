import { Currency, OfferStatus } from '@crm/shared';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Deal } from '../deals/deal.entity';
import { numericTransformer } from '../common/helpers/numeric.transformer';
import { OfferItem } from './offer-item.entity';

/** Коммерческое предложение (Приложение А, таблица CommercialOffers). */
@Entity('commercial_offers')
export class Offer {
  @PrimaryGeneratedColumn({ name: 'offer_id' })
  offerId: number;

  /** Организация-владелец записи: граница изоляции данных. */
  @Index('idx_commercial_offers_organization')
  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Index('idx_offers_deal')
  @Column({ name: 'deal_id', type: 'int' })
  dealId: number;

  @ManyToOne(() => Deal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: Deal;

  @Column({ type: 'varchar', length: 64 })
  number: string;

  @Column({ type: 'date' })
  date: string;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalAmount: number;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.DRAFT })
  status: OfferStatus;

  /** Имя файла во внутреннем хранилище uploads/. */
  @Column({ name: 'file_ref', type: 'varchar', length: 255, nullable: true })
  fileRef: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  @Column({ type: 'int', default: 1 })
  version: number;

  @OneToMany(() => OfferItem, (item) => item.offer)
  items: OfferItem[];
}
