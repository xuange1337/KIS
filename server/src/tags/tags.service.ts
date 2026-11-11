import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TagDto } from '@crm/shared';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ClientsService } from '../clients/clients.service';
import { Client } from '../clients/client.entity';
import { canAccess } from '../common/helpers/owner-scope';
import { ClientTag } from './client-tag.entity';
import { Tag } from './tag.entity';
import { CreateTagDto, UpdateTagDto } from './tags.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(ClientTag) private readonly links: Repository<ClientTag>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    private readonly clientsService: ClientsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(user: AuthUser): Promise<TagDto[]> {
    const rows = await this.dataSource.query(
      `SELECT t.tag_id AS "tagId", t.name, t.color,
              count(ct.client_id)::int AS "clientsCount"
         FROM tags t
         LEFT JOIN client_tags ct ON ct.tag_id = t.tag_id
        WHERE t.organization_id = $1
        GROUP BY t.tag_id
        ORDER BY lower(t.name)`,
      [user.organizationId],
    );
    return rows as TagDto[];
  }

  async create(dto: CreateTagDto, user: AuthUser): Promise<Tag> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');
    await this.assertNameFree(name, user.organizationId);
    return this.tags.save(
      this.tags.create({
        organizationId: user.organizationId,
        name,
        color: dto.color.toUpperCase(),
      }),
    );
  }

  async update(id: number, dto: UpdateTagDto, user: AuthUser): Promise<Tag> {
    const tag = await this.find(id, user);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');
    if (name.toLowerCase() !== tag.name.toLowerCase())
      await this.assertNameFree(name, user.organizationId);
    tag.name = name;
    tag.color = dto.color.toUpperCase();
    return this.tags.save(tag);
  }

  async remove(id: number, user: AuthUser): Promise<{ success: true }> {
    await this.find(id, user);
    await this.tags.delete({ tagId: id, organizationId: user.organizationId });
    return { success: true };
  }

  /** Метки одного клиента (с проверкой, что клиент пользователю виден). */
  async forClient(clientId: number, user: AuthUser): Promise<Tag[]> {
    await this.clientsService.findOne(clientId, user);
    return this.tagsOf([clientId], user.organizationId).then(
      (map) => map.get(clientId) ?? [],
    );
  }

  /** Полностью заменяет набор меток клиента. */
  async setForClient(
    clientId: number,
    tagIds: number[],
    user: AuthUser,
  ): Promise<Tag[]> {
    await this.clientsService.findOne(clientId, user);
    const unique = [...new Set(tagIds)];
    const found = unique.length
      ? await this.tags.findBy({
          tagId: In(unique),
          organizationId: user.organizationId,
        })
      : [];
    if (found.length !== unique.length)
      throw new NotFoundException('Метка не найдена');
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ClientTag, {
        clientId,
        organizationId: user.organizationId,
      });
      if (unique.length)
        await manager.insert(
          ClientTag,
          unique.map((tagId) => ({
            clientId,
            tagId,
            organizationId: user.organizationId,
          })),
        );
    });
    return found;
  }

  /** Добавляет метку сразу нескольким клиентам; чужих карточек не касается. */
  async addToClients(
    tagId: number,
    clientIds: number[],
    user: AuthUser,
  ): Promise<{ added: number }> {
    await this.find(tagId, user);
    const unique = [...new Set(clientIds)];
    const clients = unique.length
      ? await this.clients.findBy({
          clientId: In(unique),
          organizationId: user.organizationId,
        })
      : [];
    if (clients.length !== unique.length)
      throw new NotFoundException('Клиент не найден');
    if (clients.some((c) => !canAccess(user, c.ownerUserId)))
      throw new ConflictException('Среди клиентов есть чужие карточки');
    const result = await this.links
      .createQueryBuilder()
      .insert()
      .values(
        unique.map((clientId) => ({
          clientId,
          tagId,
          organizationId: user.organizationId,
        })),
      )
      .orIgnore()
      .execute();
    return { added: result.raw?.length ?? result.identifiers.length };
  }

  /** Метки для набора клиентов одним запросом: нужны списку клиентов. */
  async tagsOf(
    clientIds: number[],
    organizationId: number,
  ): Promise<Map<number, Tag[]>> {
    const map = new Map<number, Tag[]>();
    if (!clientIds.length) return map;
    const rows: Array<Tag & { clientId: number }> = await this.dataSource.query(
      `SELECT ct.client_id AS "clientId", t.tag_id AS "tagId", t.name, t.color
         FROM client_tags ct JOIN tags t ON t.tag_id = ct.tag_id
        WHERE ct.client_id = ANY($1) AND ct.organization_id = $2
        ORDER BY lower(t.name)`,
      [clientIds, organizationId],
    );
    for (const row of rows) {
      const list = map.get(row.clientId) ?? [];
      list.push({
        tagId: row.tagId,
        name: row.name,
        color: row.color,
      } as Tag);
      map.set(row.clientId, list);
    }
    return map;
  }

  private async find(id: number, user: AuthUser): Promise<Tag> {
    const tag = await this.tags.findOneBy({
      tagId: id,
      organizationId: user.organizationId,
    });
    if (!tag) throw new NotFoundException('Метка не найдена');
    return tag;
  }

  private async assertNameFree(
    name: string,
    organizationId: number,
  ): Promise<void> {
    const rows = await this.dataSource.query(
      'SELECT 1 FROM tags WHERE organization_id = $1 AND lower(name) = lower($2)',
      [organizationId, name],
    );
    if (rows.length)
      throw new ConflictException('Метка с таким названием уже есть');
  }
}
