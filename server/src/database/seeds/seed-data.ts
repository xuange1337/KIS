import { ClientSource, ClientStatus, INDUSTRIES } from '@crm/shared';

/** Заготовка карточки клиента для наполнения демонстрационной базы. */
export interface ClientSeed {
  name: string;
  inn: string;
  industry: string;
  status: ClientStatus;
  source: ClientSource;
  address: string;
  contacts: {
    fullName: string;
    position: string;
    phone: string;
    email: string;
  }[];
}

const [
  RETAIL,
  WHOLESALE,
  MANUFACTURING,
  CONSTRUCTION,
  LOGISTICS,
  IT,
  FINANCE,
  MEDICINE,
  EDUCATION,
  GOVERNMENT,
] = INDUSTRIES;

/**
 * Демонстрационная клиентская база: 20 организаций с контактными лицами.
 * Данные вымышленные, ИНН сгенерированы и не принадлежат реальным компаниям.
 */
export const CLIENT_SEEDS: ClientSeed[] = [
  {
    name: 'ООО «Северный Торговый Дом»',
    inn: '7701234567',
    industry: WHOLESALE,
    status: ClientStatus.ACTIVE,
    source: ClientSource.EXHIBITION,
    address: 'г. Москва, ул. Складочная, д. 12, стр. 3',
    contacts: [
      {
        fullName: 'Кузнецов Андрей Петрович',
        position: 'Коммерческий директор',
        phone: '+7 495 120-45-678',
        email: 'a.kuznetsov@severtd.example',
      },
      {
        fullName: 'Белова Марина Игоревна',
        position: 'Менеджер по закупкам',
        phone: '+7 495 120-45-679',
        email: 'm.belova@severtd.example',
      },
    ],
  },
  {
    name: 'АО «Уралмашпром»',
    inn: '6659012345',
    industry: MANUFACTURING,
    status: ClientStatus.ACTIVE,
    source: ClientSource.PARTNER,
    address: 'г. Екатеринбург, пр. Космонавтов, д. 45',
    contacts: [
      {
        fullName: 'Сафин Ринат Маратович',
        position: 'Начальник отдела снабжения',
        phone: '+7 343 210-33-01',
        email: 'r.safin@uralmashprom.example',
      },
    ],
  },
  {
    name: 'ООО «ТехноСтройМонтаж»',
    inn: '7810456789',
    industry: CONSTRUCTION,
    status: ClientStatus.IN_WORK,
    source: ClientSource.WEBSITE,
    address: 'г. Санкт-Петербург, наб. Обводного канала, д. 118',
    contacts: [
      {
        fullName: 'Григорьев Олег Владимирович',
        position: 'Главный инженер проекта',
        phone: '+7 812 445-67-89',
        email: 'o.grigoriev@tsm-spb.example',
      },
      {
        fullName: 'Ткачук Елена Сергеевна',
        position: 'Специалист тендерного отдела',
        phone: '+7 812 445-67-90',
        email: 'e.tkachuk@tsm-spb.example',
      },
    ],
  },
  {
    name: 'ООО «ЛогистикПро»',
    inn: '5024567890',
    industry: LOGISTICS,
    status: ClientStatus.ACTIVE,
    source: ClientSource.RECOMMENDATION,
    address: 'Московская обл., г. Красногорск, ул. Транспортная, д. 7',
    contacts: [
      {
        fullName: 'Мельников Дмитрий Юрьевич',
        position: 'Директор по логистике',
        phone: '+7 498 720-11-22',
        email: 'd.melnikov@logistikpro.example',
      },
    ],
  },
  {
    name: 'ЗАО «Медтехника-Сервис»',
    inn: '7736789012',
    industry: MEDICINE,
    status: ClientStatus.IN_WORK,
    source: ClientSource.CALL,
    address: 'г. Москва, Каширское шоссе, д. 22, корп. 1',
    contacts: [
      {
        fullName: 'Орлова Наталья Викторовна',
        position: 'Заведующая отделом закупок',
        phone: '+7 495 388-90-12',
        email: 'n.orlova@medtehservice.example',
      },
    ],
  },
  {
    name: 'ООО «ИТ-Решения Плюс»',
    inn: '7743210987',
    industry: IT,
    status: ClientStatus.ACTIVE,
    source: ClientSource.WEBSITE,
    address: 'г. Москва, ул. Профсоюзная, д. 84/32',
    contacts: [
      {
        fullName: 'Данилов Сергей Александрович',
        position: 'Технический директор',
        phone: '+7 495 662-14-08',
        email: 's.danilov@itplus.example',
      },
      {
        fullName: 'Романова Ольга Дмитриевна',
        position: 'Руководитель проектов',
        phone: '+7 495 662-14-09',
        email: 'o.romanova@itplus.example',
      },
    ],
  },
  {
    name: 'ПАО «Финанс-Инвест Групп»',
    inn: '7702345678',
    industry: FINANCE,
    status: ClientStatus.LEAD,
    source: ClientSource.ADVERTISING,
    address: 'г. Москва, Пресненская наб., д. 10, блок С',
    contacts: [
      {
        fullName: 'Ефимов Виктор Станиславович',
        position: 'Руководитель департамента развития',
        phone: '+7 495 777-30-40',
        email: 'v.efimov@finansinvest.example',
      },
    ],
  },
  {
    name: 'ООО «Сибирская Продуктовая Сеть»',
    inn: '5406123456',
    industry: RETAIL,
    status: ClientStatus.ACTIVE,
    source: ClientSource.EXHIBITION,
    address: 'г. Новосибирск, ул. Богдана Хмельницкого, д. 56',
    contacts: [
      {
        fullName: 'Захарова Ирина Леонидовна',
        position: 'Категорийный менеджер',
        phone: '+7 383 299-45-10',
        email: 'i.zaharova@sibprodset.example',
      },
    ],
  },
  {
    name: 'ФГБОУ ВО «Политехнический институт»',
    inn: '7813456123',
    industry: EDUCATION,
    status: ClientStatus.IN_WORK,
    source: ClientSource.PARTNER,
    address: 'г. Санкт-Петербург, ул. Политехническая, д. 29',
    contacts: [
      {
        fullName: 'Литвинова Анна Борисовна',
        position: 'Начальник управления закупок',
        phone: '+7 812 297-20-95',
        email: 'a.litvinova@polytech.example',
      },
    ],
  },
  {
    name: 'ГБУ «Центр городских услуг»',
    inn: '7704567123',
    industry: GOVERNMENT,
    status: ClientStatus.LEAD,
    source: ClientSource.WEBSITE,
    address: 'г. Москва, ул. Новый Арбат, д. 36',
    contacts: [
      {
        fullName: 'Панов Игорь Николаевич',
        position: 'Заместитель руководителя',
        phone: '+7 495 957-70-70',
        email: 'i.panov@cgu.example',
      },
    ],
  },
  {
    name: 'ООО «АгроТрейд Кубань»',
    inn: '2310678901',
    industry: WHOLESALE,
    status: ClientStatus.IN_WORK,
    source: ClientSource.RECOMMENDATION,
    address: 'г. Краснодар, ул. Северная, д. 324',
    contacts: [
      {
        fullName: 'Гончаренко Павел Иванович',
        position: 'Коммерческий директор',
        phone: '+7 861 210-88-33',
        email: 'p.goncharenko@agrotrade.example',
      },
    ],
  },
  {
    name: 'ООО «СтройМатериалы-Волга»',
    inn: '6316789012',
    industry: CONSTRUCTION,
    status: ClientStatus.ACTIVE,
    source: ClientSource.CALL,
    address: 'г. Самара, Московское шоссе, д. 41',
    contacts: [
      {
        fullName: 'Никитина Светлана Аркадьевна',
        position: 'Руководитель отдела продаж',
        phone: '+7 846 331-04-77',
        email: 's.nikitina@sm-volga.example',
      },
    ],
  },
  {
    name: 'ООО «Дальневосточные Перевозки»',
    inn: '2540890123',
    industry: LOGISTICS,
    status: ClientStatus.LEAD,
    source: ClientSource.ADVERTISING,
    address: 'г. Владивосток, ул. Портовая, д. 3',
    contacts: [
      {
        fullName: 'Хабаров Максим Олегович',
        position: 'Начальник транспортного отдела',
        phone: '+7 423 240-15-60',
        email: 'm.habarov@dvperevozki.example',
      },
    ],
  },
  {
    name: 'ООО «Клиника Здоровье+»',
    inn: '5259012345',
    industry: MEDICINE,
    status: ClientStatus.ACTIVE,
    source: ClientSource.RECOMMENDATION,
    address: 'г. Нижний Новгород, ул. Белинского, д. 61',
    contacts: [
      {
        fullName: 'Тарасова Юлия Михайловна',
        position: 'Главный врач',
        phone: '+7 831 421-77-05',
        email: 'y.tarasova@zdorovie-plus.example',
      },
    ],
  },
  {
    name: 'ООО «ЦифраСофт»',
    inn: '7728901234',
    industry: IT,
    status: ClientStatus.IN_WORK,
    source: ClientSource.WEBSITE,
    address: 'г. Москва, ул. Наметкина, д. 14, корп. 2',
    contacts: [
      {
        fullName: 'Шевченко Артём Валерьевич',
        position: 'Директор по развитию',
        phone: '+7 495 411-92-30',
        email: 'a.shevchenko@cifrasoft.example',
      },
    ],
  },
  {
    name: 'АО «Страховая компания Гарант-Полис»',
    inn: '7705012378',
    industry: FINANCE,
    status: ClientStatus.IN_WORK,
    source: ClientSource.PARTNER,
    address: 'г. Москва, ул. Летниковская, д. 10, стр. 4',
    contacts: [
      {
        fullName: 'Абрамов Константин Львович',
        position: 'Руководитель корпоративного отдела',
        phone: '+7 495 660-25-14',
        email: 'k.abramov@garant-polis.example',
      },
    ],
  },
  {
    name: 'ООО «Мебельная Фабрика Комфорт»',
    inn: '3906123789',
    industry: MANUFACTURING,
    status: ClientStatus.ACTIVE,
    source: ClientSource.EXHIBITION,
    address: 'г. Калининград, ул. Мукомольная, д. 18',
    contacts: [
      {
        fullName: 'Соколова Вера Анатольевна',
        position: 'Директор по продажам',
        phone: '+7 4012 55-31-08',
        email: 'v.sokolova@mf-komfort.example',
      },
    ],
  },
  {
    name: 'ООО «Розница-Юг»',
    inn: '6167234890',
    industry: RETAIL,
    status: ClientStatus.ARCHIVED,
    source: ClientSource.CALL,
    address: 'г. Ростов-на-Дону, пр. Стачки, д. 231',
    contacts: [
      {
        fullName: 'Демидов Роман Сергеевич',
        position: 'Управляющий сетью',
        phone: '+7 863 200-56-41',
        email: 'r.demidov@roznica-ug.example',
      },
    ],
  },
  {
    name: 'ООО «ЭнергоМонтажСервис»',
    inn: '5905345601',
    industry: CONSTRUCTION,
    status: ClientStatus.LEAD,
    source: ClientSource.WEBSITE,
    address: 'г. Пермь, ул. Героев Хасана, д. 105',
    contacts: [
      {
        fullName: 'Валиев Ильдар Рафисович',
        position: 'Главный энергетик',
        phone: '+7 342 259-14-72',
        email: 'i.valiev@ems-perm.example',
      },
    ],
  },
  {
    name: 'ООО «Образовательный центр Профи»',
    inn: '7449456712',
    industry: EDUCATION,
    status: ClientStatus.IN_WORK,
    source: ClientSource.ADVERTISING,
    address: 'г. Челябинск, пр. Ленина, д. 78',
    contacts: [
      {
        fullName: 'Крылова Дарья Евгеньевна',
        position: 'Директор',
        phone: '+7 351 700-23-19',
        email: 'd.krylova@profi-centr.example',
      },
    ],
  },
];

/** Шаблоны названий сделок — подставляется наименование клиента. */
export const DEAL_TITLES = [
  'Поставка оборудования',
  'Годовой сервисный контракт',
  'Внедрение системы учёта',
  'Модернизация складского комплекса',
  'Комплексная поставка расходных материалов',
  'Пилотный проект автоматизации',
  'Расширение действующего договора',
  'Техническое обслуживание на 2026 год',
  'Закупка программного обеспечения',
  'Проект по оптимизации логистики',
];

/** Темы активностей по типам — для правдоподобного календаря. */
export const ACTIVITY_SUBJECTS = {
  call: [
    'Первичный звонок по заявке',
    'Уточнение потребности клиента',
    'Согласование условий поставки',
    'Напоминание о коммерческом предложении',
    'Контроль оплаты счёта',
  ],
  meeting: [
    'Встреча в офисе клиента',
    'Презентация решения',
    'Переговоры по договору',
    'Демонстрация оборудования',
    'Подписание документов',
  ],
  email: [
    'Отправка коммерческого предложения',
    'Направление спецификации',
    'Письмо с уточнением сроков',
    'Отправка договора на согласование',
    'Информационная рассылка по новинкам',
  ],
} as const;

/** Формулировки результатов выполненных активностей. */
export const ACTIVITY_RESULTS = [
  'Клиент подтвердил интерес, договорились о следующем шаге',
  'Запрошена дополнительная информация по спецификации',
  'Согласованы сроки поставки',
  'Требуется доработать коммерческое предложение',
  'Решение отложено до следующего квартала',
  'Достигнута договорённость о подписании договора',
];
