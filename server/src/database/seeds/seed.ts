import 'reflect-metadata';
import {
  ACTIVITY_TYPE_LABELS,
  ActivityStatus,
  ActivityType,
  Currency,
  DEAL_STAGE_PROBABILITY,
  DealStage,
  OfferStatus,
  PreferredChannel,
  UserRole,
  isClosedStage,
} from '@crm/shared';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../data-source';
import { User } from '../../users/user.entity';
import { Client } from '../../clients/client.entity';
import { Contact } from '../../contacts/contact.entity';
import { Deal } from '../../deals/deal.entity';
import { DealStageHistory } from '../../deals/deal-stage-history.entity';
import { Activity } from '../../activities/activity.entity';
import { Offer } from '../../offers/offer.entity';
import { Organization } from '../../organizations/organization.entity';
import {
  ACTIVITY_RESULTS,
  ACTIVITY_SUBJECTS,
  CLIENT_SEEDS,
  DEAL_TITLES,
} from './seed-data';

/**
 * Наполнение демонстрационной базы (ТЗ, этап проверки отчётов).
 *
 * Генератор детерминированный: при одинаковом состоянии базы результат
 * повторяется, поэтому отчёты и скриншоты стабильны между прогонами.
 */

/** Организация демонстрационных данных. */
const DEMO_ORGANIZATION = 'ООО «Демонстрация»';

/** Вторая организация: на ней проверяется изоляция данных. */
const OTHER_ORGANIZATION = 'ЗАО «Соседняя компания»';

/** Линейный конгруэнтный генератор — вместо Math.random, чтобы данные не «плавали». */
class Random {
  constructor(private seed = 20260101) {}

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) % 2147483648;
    return this.seed / 2147483648;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Сумма, округлённая до десятков тысяч — как в реальных сделках. */
  amount(min: number, max: number): number {
    return this.int(min / 10000, max / 10000) * 10000;
  }
}

const rnd = new Random();

const DAY_MS = 24 * 60 * 60 * 1000;

/** Дата со сдвигом в днях от текущего момента. */
const shiftDays = (days: number, hour?: number): Date => {
  const date = new Date(Date.now() + days * DAY_MS);
  if (hour !== undefined) {
    date.setHours(hour, rnd.pick([0, 15, 30, 45]), 0, 0);
  }
  return date;
};

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const SEED_USERS = [
  {
    login: 'admin',
    password: 'admin123',
    fullName: 'Администратор Системы',
    role: UserRole.ADMIN,
  },
  {
    login: 'head',
    password: 'head123',
    fullName: 'Соловьёв Игорь Валентинович',
    role: UserRole.HEAD,
  },
  {
    login: 'manager',
    password: 'manager123',
    fullName: 'Орлов Григорий Николаевич',
    role: UserRole.MANAGER,
  },
  {
    login: 'manager2',
    password: 'manager123',
    fullName: 'Фёдорова Алиса Романовна',
    role: UserRole.MANAGER,
  },
];

/**
 * Наполняет переданную базу демонстрационными данными.
 * Экспортируется, чтобы тот же генератор использовался и CLI-командой,
 * и подготовкой тестовой базы (test/global-setup.ts) — иначе тесты
 * проверяли бы данные, отличные от тех, что видит пользователь.
 *
 * @param external уже инициализированный DataSource; если не передан,
 *                 подключение создаётся по переменным окружения
 * @param quiet    подавляет пошаговый вывод (нужно в тестах)
 */
export async function seed(
  external?: DataSource,
  quiet = false,
): Promise<void> {
  const log = (...args: unknown[]) => {
    if (!quiet) console.log(...args);
  };

  const dataSource =
    external ??
    new DataSource({ ...buildDataSourceOptions(), migrationsRun: false });
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const userRepo = dataSource.getRepository(User);
  if (await userRepo.exists({ where: { login: 'admin' } })) {
    log(
      'База уже содержит демонстрационные данные. Очистите её (docker compose down -v) и повторите.',
    );
    if (!external) await dataSource.destroy();
    return;
  }

  log('Создание организации...');
  const organizationRepo = dataSource.getRepository(Organization);
  const organization =
    (await organizationRepo.findOne({ where: { name: DEMO_ORGANIZATION } })) ??
    (await organizationRepo.save(
      organizationRepo.create({ name: DEMO_ORGANIZATION }),
    ));
  const organizationId = organization.organizationId;

  log('Создание пользователей...');
  const users: User[] = [];
  for (const seedUser of SEED_USERS) {
    users.push(
      await userRepo.save(
        userRepo.create({
          organizationId,
          login: seedUser.login,
          fullName: seedUser.fullName,
          role: seedUser.role,
          isActive: true,
          passwordHash: await bcrypt.hash(seedUser.password, 10),
        }),
      ),
    );
  }
  // Клиенты и сделки распределяются между двумя менеджерами,
  // чтобы разграничение доступа и отчёт по сотрудникам были наглядными
  const managers = users.filter((user) => user.role === UserRole.MANAGER);

  log('Создание клиентов и контактных лиц...');
  const clientRepo = dataSource.getRepository(Client);
  const contactRepo = dataSource.getRepository(Contact);
  const clients: Client[] = [];

  for (const [index, seedClient] of CLIENT_SEEDS.entries()) {
    const client = await clientRepo.save(
      clientRepo.create({
        organizationId,
        name: seedClient.name,
        inn: seedClient.inn,
        industry: seedClient.industry,
        status: seedClient.status,
        source: seedClient.source,
        address: seedClient.address,
        ownerUserId: managers[index % managers.length].userId,
        createdAt: shiftDays(-rnd.int(30, 220)),
      }),
    );
    clients.push(client);

    for (const seedContact of seedClient.contacts) {
      await contactRepo.save(
        contactRepo.create({
          organizationId,
          clientId: client.clientId,
          fullName: seedContact.fullName,
          position: seedContact.position,
          phone: seedContact.phone,
          email: seedContact.email,
          preferredChannel: rnd.pick(Object.values(PreferredChannel)),
        }),
      );
    }
  }

  log('Создание сделок и истории стадий...');
  const dealRepo = dataSource.getRepository(Deal);
  const historyRepo = dataSource.getRepository(DealStageHistory);
  const deals: Deal[] = [];

  // Распределение стадий подобрано так, чтобы воронка сужалась к закрытию
  const stagePlan: DealStage[] = [
    ...Array<DealStage>(5).fill(DealStage.NEW),
    ...Array<DealStage>(6).fill(DealStage.QUALIFICATION),
    ...Array<DealStage>(5).fill(DealStage.PROPOSAL),
    ...Array<DealStage>(4).fill(DealStage.NEGOTIATION),
    ...Array<DealStage>(8).fill(DealStage.WON),
    ...Array<DealStage>(4).fill(DealStage.LOST),
  ];

  for (const [index, stage] of stagePlan.entries()) {
    const client = clients[index % clients.length];
    const createdAt = shiftDays(-rnd.int(20, 180));
    // Закрытые сделки закрываются позже даты создания, но не в будущем —
    // иначе отчёт «Динамика продаж» покажет продажи вперёд по календарю
    const closedAt = isClosedStage(stage)
      ? new Date(
          Math.min(
            createdAt.getTime() + rnd.int(5, 60) * DAY_MS,
            Date.now() - DAY_MS,
          ),
        )
      : null;

    const deal = await dealRepo.save(
      dealRepo.create({
        organizationId,
        clientId: client.clientId,
        title: `${rnd.pick(DEAL_TITLES)} — ${client.name}`,
        stage,
        amount: rnd.amount(150_000, 4_500_000),
        currency: Currency.RUB,
        probability: DEAL_STAGE_PROBABILITY[stage],
        plannedClose: toDateOnly(shiftDays(rnd.int(-40, 90))),
        ownerUserId: client.ownerUserId,
        createdAt,
        closedAt,
      }),
    );
    deals.push(deal);

    // История: сделка последовательно проходит стадии до текущей
    const path = buildStagePath(stage);
    let previous: DealStage | null = null;
    for (const [step, pathStage] of path.entries()) {
      await historyRepo.save(
        historyRepo.create({
          organizationId,
          dealId: deal.dealId,
          fromStage: previous,
          toStage: pathStage,
          changedBy: deal.ownerUserId,
          changedAt: new Date(createdAt.getTime() + step * 3 * DAY_MS),
        }),
      );
      previous = pathStage;
    }
  }

  log('Создание активностей...');
  const activityRepo = dataSource.getRepository(Activity);
  const activityTypes = Object.values(ActivityType);

  for (let index = 0; index < 70; index += 1) {
    const deal = deals[index % deals.length];

    // Треть активностей — просроченные, треть выполненные, треть предстоящие:
    // так наполняются дашборд и отчёт о просроченных задачах
    const bucket = index % 3;
    // Тип выбирается случайно, а не по индексу: иначе он жёстко совпал бы
    // с bucket, и все предстоящие активности оказались бы письмами
    const type = rnd.pick(activityTypes);
    const plannedAt =
      bucket === 0
        ? shiftDays(-rnd.int(1, 21), rnd.int(9, 18))
        : bucket === 1
          ? shiftDays(-rnd.int(1, 45), rnd.int(9, 18))
          : shiftDays(rnd.int(0, 14), rnd.int(9, 18));
    const status = bucket === 1 ? ActivityStatus.DONE : ActivityStatus.PLANNED;

    await activityRepo.save(
      activityRepo.create({
        organizationId,
        clientId: deal.clientId,
        dealId: index % 4 === 3 ? null : deal.dealId,
        type,
        subject: rnd.pick(ACTIVITY_SUBJECTS[type]),
        plannedAt,
        status,
        doneAt:
          status === ActivityStatus.DONE
            ? new Date(plannedAt.getTime() + rnd.int(0, 6) * 60 * 60 * 1000)
            : null,
        result:
          status === ActivityStatus.DONE ? rnd.pick(ACTIVITY_RESULTS) : null,
        comment:
          index % 5 === 0
            ? `${ACTIVITY_TYPE_LABELS[type]} по инициативе клиента`
            : null,
        ownerUserId: deal.ownerUserId,
      }),
    );
  }

  log('Создание коммерческих предложений...');
  const offerRepo = dataSource.getRepository(Offer);
  // КП оформляются по сделкам, дошедшим до стадии предложения и дальше
  const offerDeals = deals.filter(
    (deal) =>
      deal.stage !== DealStage.NEW && deal.stage !== DealStage.QUALIFICATION,
  );

  for (const [index, deal] of offerDeals.slice(0, 14).entries()) {
    await offerRepo.save(
      offerRepo.create({
        organizationId,
        dealId: deal.dealId,
        number: `КП-2026/${String(index + 1).padStart(3, '0')}`,
        date: toDateOnly(shiftDays(-rnd.int(5, 90))),
        totalAmount: deal.amount,
        status:
          deal.stage === DealStage.WON
            ? OfferStatus.ACCEPTED
            : deal.stage === DealStage.LOST
              ? OfferStatus.REJECTED
              : rnd.pick([OfferStatus.DRAFT, OfferStatus.SENT]),
      }),
    );
  }

  await seedSecondOrganization(dataSource, log);

  const counts = {
    пользователи: users.length,
    клиенты: clients.length,
    сделки: deals.length,
    активности: await activityRepo.count(),
    'коммерческие предложения': await offerRepo.count(),
  };
  log('Демонстрационные данные загружены:', counts);
  log('Учётные записи: admin/admin123, head/head123, manager/manager123');

  // Чужое подключение закрывает тот, кто его открыл
  if (!external) await dataSource.destroy();
}

/**
 * Вторая организация с собственными данными.
 *
 * Изоляция организаций проверяется только на данных двух организаций:
 * пока в базе одна, любой запрос выглядит корректным. Набор намеренно
 * маленький — он нужен как контрольный, а не как демонстрационный.
 */
async function seedSecondOrganization(
  dataSource: DataSource,
  log: (...args: unknown[]) => void,
): Promise<void> {
  log('Создание контрольной организации...');
  const organizationRepo = dataSource.getRepository(Organization);
  const organization = await organizationRepo.save(
    organizationRepo.create({ name: OTHER_ORGANIZATION }),
  );
  const organizationId = organization.organizationId;

  const userRepo = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash('other123', 10);
  const otherAdmin = await userRepo.save(
    userRepo.create({
      organizationId,
      login: 'other-admin',
      fullName: 'Администратор Другой Организации',
      role: UserRole.ADMIN,
      isActive: true,
      passwordHash,
    }),
  );
  const otherManager = await userRepo.save(
    userRepo.create({
      organizationId,
      login: 'other-manager',
      fullName: 'Менеджер Другой Организации',
      role: UserRole.MANAGER,
      isActive: true,
      passwordHash,
    }),
  );

  const client = await dataSource.getRepository(Client).save({
    organizationId,
    name: 'ЗАО «Соседний Заказчик»',
    inn: '7701234567',
    industry: 'Логистика',
    ownerUserId: otherManager.userId,
  } as Client);

  await dataSource.getRepository(Contact).save({
    organizationId,
    clientId: client.clientId,
    fullName: 'Петров Пётр Петрович',
    position: 'Директор',
    phone: '+7 495 000-00-00',
  } as Contact);

  const deal = await dataSource.getRepository(Deal).save({
    organizationId,
    clientId: client.clientId,
    title: 'Поставка соседней организации',
    stage: DealStage.PROPOSAL,
    amount: 500000,
    currency: Currency.RUB,
    probability: DEAL_STAGE_PROBABILITY[DealStage.PROPOSAL],
    ownerUserId: otherManager.userId,
  } as Deal);

  await dataSource.getRepository(DealStageHistory).save({
    organizationId,
    dealId: deal.dealId,
    fromStage: null,
    toStage: DealStage.PROPOSAL,
    changedBy: otherAdmin.userId,
  } as DealStageHistory);

  await dataSource.getRepository(Activity).save({
    organizationId,
    clientId: client.clientId,
    dealId: deal.dealId,
    type: ActivityType.CALL,
    subject: 'Звонок соседней организации',
    plannedAt: shiftDays(1),
    status: ActivityStatus.PLANNED,
    ownerUserId: otherManager.userId,
  } as Activity);

  await dataSource.getRepository(Offer).save({
    organizationId,
    dealId: deal.dealId,
    number: 'КП-СОСЕД/001',
    date: toDateOnly(shiftDays(-3)),
    totalAmount: 500000,
    status: OfferStatus.SENT,
  } as Offer);
}

/** Последовательность стадий, пройденных сделкой до текущей. */
function buildStagePath(stage: DealStage): DealStage[] {
  const order = [
    DealStage.NEW,
    DealStage.QUALIFICATION,
    DealStage.PROPOSAL,
    DealStage.NEGOTIATION,
  ];
  if (!isClosedStage(stage)) {
    return order.slice(0, order.indexOf(stage) + 1);
  }
  // Проигранные сделки закрываются с разных стадий, выигранные — после переговоров
  const beforeClose =
    stage === DealStage.WON ? order : order.slice(0, rnd.int(2, 4));
  return [...beforeClose, stage];
}

// Автозапуск только при вызове файла напрямую (npm run seed),
// чтобы импорт из тестов не наполнял базу как побочный эффект
if (require.main === module) {
  seed().catch((error) => {
    console.error('Не удалось загрузить демонстрационные данные:', error);
    process.exit(1);
  });
}
