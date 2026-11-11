import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('client_tags')
export class ClientTag {
  @PrimaryColumn({ name: 'client_id', type: 'int' })
  clientId: number;

  @PrimaryColumn({ name: 'tag_id', type: 'int' })
  tagId: number;

  @Column({ name: 'organization_id', type: 'int' })
  organizationId: number;
}
