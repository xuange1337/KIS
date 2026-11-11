import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { canAccess } from '../common/helpers/owner-scope';
import { Client } from '../clients/client.entity';
import { Deal } from '../deals/deal.entity';

export type RecordType = 'client' | 'deal';

export interface VisibleRecord {
  ownerUserId: number | null;
  title: string;
  link: string;
}

/** Проверка, что запись существует, принадлежит организации и видна пользователю. */
@Injectable()
export class RecordAccessService {
  constructor(
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(Deal) private readonly deals: Repository<Deal>,
  ) {}

  async assertVisible(
    type: RecordType,
    id: number,
    user: AuthUser,
  ): Promise<VisibleRecord> {
    if (type === 'client') {
      const client = await this.clients.findOneBy({
        clientId: id,
        organizationId: user.organizationId,
      });
      if (!client) throw new NotFoundException('Запись не найдена');
      this.assertOwner(user, client.ownerUserId);
      return {
        ownerUserId: client.ownerUserId,
        title: client.name,
        link: `/clients/${id}`,
      };
    }
    const deal = await this.deals.findOneBy({
      dealId: id,
      organizationId: user.organizationId,
    });
    if (!deal) throw new NotFoundException('Запись не найдена');
    this.assertOwner(user, deal.ownerUserId);
    return {
      ownerUserId: deal.ownerUserId,
      title: deal.title,
      link: `/deals/${id}`,
    };
  }

  private assertOwner(user: AuthUser, ownerUserId: number | null) {
    if (!canAccess(user, ownerUserId))
      throw new ForbiddenException('Запись закреплена за другим менеджером');
  }
}
