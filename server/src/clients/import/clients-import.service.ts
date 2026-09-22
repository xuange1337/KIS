import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ClientStatus,
  ImportPreview,
  ImportResult,
  ImportRow,
} from '@crm/shared';
import { DataSource, Repository } from 'typeorm';
import { Client } from '../client.entity';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { canSeeAll } from '../../common/helpers/owner-scope';
import { MAX_IMPORT_ROWS, parseImportFile } from './import-parser';

/**
 * Загрузка клиентской базы из файла.
 *
 * Перенос базы из таблицы вручную — это сотни карточек и несколько дней
 * работы, поэтому импорт есть в любой CRM. Опасность у него ровно одна:
 * молча создать сотню дублей или наполовину загрузить кривой файл,
 * оставив базу в состоянии, которое непонятно как откатывать.
 *
 * Поэтому загрузка идёт в два шага: сначала предпросмотр с построчными
 * ошибками — без единой записи в базу, потом сама загрузка одной
 * транзакцией.
 */
@Injectable()
export class ClientsImportService {
  constructor(
    @InjectRepository(Client)
    private readonly repo: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  /** Разбор файла и проверка строк без записи в базу. */
  async preview(
    buffer: Buffer,
    fileName: string,
    user: AuthUser,
  ): Promise<ImportPreview> {
    const parsed = await parseImportFile(buffer, fileName);
    const rows = await this.markExisting(parsed.rows, user);

    return {
      columns: parsed.columns,
      rows,
      validCount: rows.filter((row) => row.errors.length === 0).length,
      errorCount: rows.filter((row) => row.errors.length > 0).length,
    };
  }

  /**
   * Загрузка проверенных строк.
   *
   * Строки приходят от клиента, но проверяются заново: предпросмотр —
   * это удобство, а не источник доверия, и между ним и загрузкой в базе
   * мог появиться клиент с тем же ИНН.
   */
  async import(rows: ImportRow[], user: AuthUser): Promise<ImportResult> {
    if (rows.length === 0) {
      throw new BadRequestException('Нет строк для загрузки');
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `За один раз загружается не более ${MAX_IMPORT_ROWS} строк`,
      );
    }

    const checked = await this.markExisting(rows, user);
    const valid = checked.filter((row) => row.errors.length === 0);
    const failed = checked.filter((row) => row.errors.length > 0);

    if (valid.length > 0) {
      // Одна транзакция: наполовину загруженный файл оставляет базу в
      // состоянии, которое пользователю непонятно как откатывать
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Client).insert(
          valid.map((row) => ({
            organizationId: user.organizationId,
            name: row.name,
            inn: row.inn,
            industry: row.industry,
            status: row.status ?? ClientStatus.LEAD,
            source: row.source,
            address: row.address,
            // Загруженные карточки закрепляются за загрузившим:
            // иначе они не видны никому, кроме руководителя
            ownerUserId: user.userId,
          })),
        );
      });
    }

    return {
      created: valid.length,
      skipped: failed.length,
      errors: failed.map((row) => ({
        line: row.line,
        name: row.name,
        errors: row.errors,
      })),
    };
  }

  /**
   * Отмечает строки, для которых клиент уже заведён.
   *
   * Сверка идёт по ИНН и по наименованию: ИНН надёжнее, но в выгрузках
   * его часто нет. Проверка одна на весь файл, а не по строке — иначе
   * это сотни запросов подряд.
   */
  private async markExisting(
    rows: ImportRow[],
    user: AuthUser,
  ): Promise<ImportRow[]> {
    const inns = rows
      .map((row) => row.inn)
      .filter((inn): inn is string => !!inn);
    const names = rows.map((row) => row.name).filter(Boolean);

    const qb = this.repo
      .createQueryBuilder('client')
      .where('client.organizationId = :organizationId', {
        organizationId: user.organizationId,
      });
    // Сверка идёт по всей организации, а не по своим записям: дубль
    // у коллеги — это тоже дубль, хотя менеджер его и не видит
    if (inns.length > 0 || names.length > 0) {
      qb.andWhere(
        '(client.inn IN (:...inns) OR LOWER(client.name) IN (:...names))',
        {
          inns: inns.length > 0 ? inns : [''],
          names:
            names.length > 0 ? names.map((name) => name.toLowerCase()) : [''],
        },
      );
    }
    const existing = await qb.getMany();

    const byInn = new Set(
      existing.map((client) => client.inn).filter(Boolean) as string[],
    );
    const byName = new Set(
      existing.map((client) => client.name.trim().toLowerCase()),
    );

    return rows.map((row) => {
      const errors = [...row.errors];
      if (row.inn && byInn.has(row.inn)) {
        errors.push('Клиент с таким ИНН уже есть в базе');
      } else if (byName.has(row.name.trim().toLowerCase())) {
        errors.push('Клиент с таким наименованием уже есть в базе');
      }
      return { ...row, errors };
    });
  }

  /** Есть ли у пользователя право загружать базу. */
  assertCanImport(user: AuthUser): void {
    if (!canSeeAll(user)) {
      // Загрузка сотен карточек меняет состав базы отдела: это
      // операция руководителя, а не рядовая правка
      throw new BadRequestException(
        'Загружать базу может руководитель или администратор',
      );
    }
  }
}
