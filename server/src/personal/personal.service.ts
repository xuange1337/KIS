import {
  BadRequestException,
  ConflictException,
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
import { Favorite } from './favorite.entity';
import { SavedFilter } from './saved-filter.entity';
import {
  ALLOWED_FILTER_KEYS,
  CreateSavedFilterDto,
  FavoriteType,
  FilterEntity,
} from './personal.dto';

@Injectable()
export class PersonalService {
  constructor(
    @InjectRepository(SavedFilter)
    private readonly filters: Repository<SavedFilter>,
    @InjectRepository(Favorite)
    private readonly favorites: Repository<Favorite>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(Deal) private readonly deals: Repository<Deal>,
  ) {}

  listFilters(entity: FilterEntity, user: AuthUser): Promise<SavedFilter[]> {
    return this.filters.find({
      where: {
        entity,
        userId: user.userId,
        organizationId: user.organizationId,
      },
      order: { name: 'ASC' },
    });
  }

  async createFilter(
    dto: CreateSavedFilterDto,
    user: AuthUser,
  ): Promise<SavedFilter> {
    const allowed = ALLOWED_FILTER_KEYS[dto.entity];
    const unknown = Object.keys(dto.filters).filter(
      (key) => !allowed.includes(key),
    );
    if (unknown.length)
      throw new BadRequestException(
        `Неизвестные фильтры: ${unknown.join(', ')}`,
      );
    if (!Object.keys(dto.filters).length)
      throw new BadRequestException('Нечего сохранять: фильтры не выбраны');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');
    const exists = await this.filters.existsBy({
      userId: user.userId,
      entity: dto.entity,
      name,
    });
    if (exists)
      throw new ConflictException('Набор фильтров с таким названием уже есть');
    return this.filters.save(
      this.filters.create({
        organizationId: user.organizationId,
        userId: user.userId,
        entity: dto.entity,
        name,
        filters: dto.filters,
      }),
    );
  }

  async removeFilter(id: number, user: AuthUser): Promise<{ success: true }> {
    // Чужой набор неотличим от несуществующего
    const result = await this.filters.delete({
      savedFilterId: id,
      userId: user.userId,
      organizationId: user.organizationId,
    });
    if (!result.affected) throw new NotFoundException('Набор не найден');
    return { success: true };
  }

  async listFavorites(type: FavoriteType, user: AuthUser): Promise<number[]> {
    const rows = await this.favorites.find({
      where: {
        entityType: type,
        userId: user.userId,
        organizationId: user.organizationId,
      },
      order: { favoriteId: 'DESC' },
    });
    return rows.map((row) => row.entityId);
  }

  async addFavorite(
    type: FavoriteType,
    entityId: number,
    user: AuthUser,
  ): Promise<{ favorite: true }> {
    await this.assertVisible(type, entityId, user);
    await this.favorites
      .createQueryBuilder()
      .insert()
      .values({
        organizationId: user.organizationId,
        userId: user.userId,
        entityType: type,
        entityId,
      })
      .orIgnore()
      .execute();
    return { favorite: true };
  }

  async removeFavorite(
    type: FavoriteType,
    entityId: number,
    user: AuthUser,
  ): Promise<{ favorite: false }> {
    await this.favorites.delete({
      entityType: type,
      entityId,
      userId: user.userId,
      organizationId: user.organizationId,
    });
    return { favorite: false };
  }

  private async assertVisible(
    type: FavoriteType,
    entityId: number,
    user: AuthUser,
  ): Promise<void> {
    const record =
      type === 'client'
        ? await this.clients.findOneBy({
            clientId: entityId,
            organizationId: user.organizationId,
          })
        : await this.deals.findOneBy({
            dealId: entityId,
            organizationId: user.organizationId,
          });
    if (!record) throw new NotFoundException('Запись не найдена');
    if (!canAccess(user, record.ownerUserId))
      throw new ForbiddenException('Запись закреплена за другим менеджером');
  }
}
