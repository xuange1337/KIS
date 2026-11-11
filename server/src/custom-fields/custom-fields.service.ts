import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CustomFieldDefinition } from './custom-field.entity';
import { CreateFieldDto, UpdateFieldDto } from './custom-fields.dto';

const MAX_FIELDS_PER_ENTITY = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type CustomValues = Record<string, string | number | boolean>;

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectRepository(CustomFieldDefinition)
    private readonly repo: Repository<CustomFieldDefinition>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  list(entity: 'client' | 'deal', organizationId: number) {
    return this.repo.find({
      where: { entity, organizationId },
      order: { position: 'ASC', fieldId: 'ASC' },
    });
  }

  async create(dto: CreateFieldDto, user: AuthUser) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');
    const options = this.cleanOptions(dto.type, dto.options);
    const existing = await this.list(dto.entity, user.organizationId);
    if (existing.length >= MAX_FIELDS_PER_ENTITY)
      throw new BadRequestException(
        `Не больше ${MAX_FIELDS_PER_ENTITY} полей на сущность`,
      );
    this.assertNameFree(existing, name);
    return this.repo.save(
      this.repo.create({
        organizationId: user.organizationId,
        entity: dto.entity,
        name,
        type: dto.type,
        options,
        position: (existing.at(-1)?.position ?? 0) + 1,
      }),
    );
  }

  async update(fieldId: number, dto: UpdateFieldDto, user: AuthUser) {
    const field = await this.find(fieldId, user);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Название не может быть пустым');
    const others = (
      await this.list(field.entity as 'client', user.organizationId)
    ).filter((item) => item.fieldId !== fieldId);
    this.assertNameFree(others, name);
    field.name = name;
    if (field.type === 'select')
      field.options = this.cleanOptions('select', dto.options ?? field.options);
    return this.repo.save(field);
  }

  async remove(fieldId: number, user: AuthUser) {
    const field = await this.find(fieldId, user);
    const table = field.entity === 'client' ? 'clients' : 'deals';
    // Значения удаляемого поля убираются из карточек: иначе в jsonb
    // оставались бы ключи, которых никто не покажет и не очистит
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE ${table} SET custom_fields = custom_fields - $1
          WHERE organization_id = $2`,
        [String(fieldId), user.organizationId],
      );
      await manager.delete(CustomFieldDefinition, { fieldId });
    });
    return { success: true };
  }

  /**
   * Приводит присланные значения к виду, пригодному для хранения.
   * Берутся значения только известных полей организации; null или пустая
   * строка очищают поле. Прежние значения остальных полей сохраняются.
   */
  async normalize(
    entity: 'client' | 'deal',
    organizationId: number,
    input: Record<string, unknown> | undefined,
    current: CustomValues = {},
  ): Promise<CustomValues> {
    if (input === undefined) return current;
    const defs = await this.list(entity, organizationId);
    const byId = new Map(defs.map((def) => [String(def.fieldId), def]));
    const result: CustomValues = { ...current };
    for (const [key, raw] of Object.entries(input)) {
      const def = byId.get(key);
      if (!def) throw new BadRequestException(`Неизвестное поле: ${key}`);
      if (raw === null || raw === '') {
        delete result[key];
        continue;
      }
      result[key] = this.coerce(def, raw);
    }
    return result;
  }

  private coerce(
    def: CustomFieldDefinition,
    raw: unknown,
  ): string | number | boolean {
    const fail = (): never => {
      throw new BadRequestException(`Некорректное значение поля «${def.name}»`);
    };
    switch (def.type) {
      case 'text':
        if (typeof raw !== 'string' || raw.length > 500) return fail();
        return raw;
      case 'number': {
        const value = typeof raw === 'string' ? Number(raw) : raw;
        if (typeof value !== 'number' || !Number.isFinite(value)) return fail();
        return value;
      }
      case 'date':
        if (
          typeof raw !== 'string' ||
          !ISO_DATE.test(raw) ||
          Number.isNaN(Date.parse(raw))
        )
          return fail();
        return raw;
      case 'boolean':
        if (typeof raw !== 'boolean') return fail();
        return raw;
      default:
        if (typeof raw !== 'string' || !def.options.includes(raw))
          return fail();
        return raw;
    }
  }

  private cleanOptions(type: string, options?: string[]): string[] {
    if (type !== 'select') return [];
    const clean = [
      ...new Set((options ?? []).map((o) => o.trim()).filter(Boolean)),
    ];
    if (clean.length < 2)
      throw new BadRequestException('Для списка нужно хотя бы два значения');
    return clean;
  }

  private assertNameFree(existing: CustomFieldDefinition[], name: string) {
    if (existing.some((f) => f.name.toLowerCase() === name.toLowerCase()))
      throw new ConflictException('Поле с таким названием уже есть');
  }

  private async find(fieldId: number, user: AuthUser) {
    const field = await this.repo.findOneBy({
      fieldId,
      organizationId: user.organizationId,
    });
    if (!field) throw new NotFoundException('Поле не найдено');
    return field;
  }
}
