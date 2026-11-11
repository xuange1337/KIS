import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Deal } from './deal.entity';
import { numericTransformer } from '../common/helpers/numeric.transformer';

/** Позиция сделки: снимок товара каталога на момент добавления. */
@Entity('deal_items')
export class DealItem {
  @PrimaryGeneratedColumn({ name: 'item_id' })
  itemId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @Column({ name: 'deal_id', type: 'int' })
  dealId: number;

  @ManyToOne(() => Deal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: Deal;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @Column({ type: 'varchar', length: 64 })
  sku: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  unit: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
    transformer: numericTransformer,
  })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  totalAmount: number;
}
