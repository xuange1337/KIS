/**
 * Описание диаграмм из раздела 2.6 ТЗ.
 *
 * Один источник данных используется генератором для выпуска двух форматов:
 * .drawio (редактируется в diagrams.net) и .svg (вставляется в записку).
 * Благодаря этому изображение и редактируемый исходник не расходятся.
 *
 * Система координат — как в draw.io: X вправо, Y вниз, единицы — пиксели.
 */

/** Палитра: приглушённые деловые цвета, различимые и в чёрно-белой печати. */
export const PALETTE = {
  ui: { fill: '#dbe7f3', stroke: '#1c4e80' },
  logic: { fill: '#e3dcec', stroke: '#7c5295' },
  data: { fill: '#dbeddc', stroke: '#2e7d32' },
  report: { fill: '#fbe4cd', stroke: '#ed6c02' },
  external: { fill: '#eceff1', stroke: '#607d8b' },
  accent: { fill: '#fadbdb', stroke: '#c62828' },
  plain: { fill: '#ffffff', stroke: '#455a64' },
};

/** 1. Диаграмма модулей и потоков данных (п. 2.6.1). */
const modules = {
  file: '01-moduli-i-potoki-dannyh',
  title: 'Рисунок 1 — Диаграмма модулей и потоков данных',
  width: 1220,
  height: 700,
  nodes: [
    { id: 'user', label: 'Менеджер\nпо работе с клиентами', x: 40, y: 330, w: 190, h: 70, shape: 'rounded', color: 'external' },
    { id: 'head', label: 'Руководитель\nотдела продаж', x: 40, y: 60, w: 190, h: 64, shape: 'rounded', color: 'external' },
    { id: 'admin', label: 'Администратор', x: 40, y: 620, w: 190, h: 56, shape: 'rounded', color: 'external' },

    { id: 'spa', label: 'Web-клиент (SPA)\nэкранные формы АРМ', x: 300, y: 320, w: 220, h: 90, shape: 'box', color: 'ui' },
    { id: 'auth', label: 'Авторизация\nи разграничение прав', x: 300, y: 150, w: 220, h: 70, shape: 'box', color: 'ui' },

    { id: 'clients', label: 'Модуль управления\nклиентами (1.2.1)', x: 590, y: 40, w: 210, h: 66, shape: 'box', color: 'logic' },
    { id: 'contacts', label: 'Модуль контактов\n(1.2.2)', x: 590, y: 138, w: 210, h: 66, shape: 'box', color: 'logic' },
    { id: 'deals', label: 'Модуль сделок\n(1.2.3)', x: 590, y: 236, w: 210, h: 66, shape: 'box', color: 'logic' },
    { id: 'acts', label: 'Модуль активностей\n(1.2.4)', x: 590, y: 334, w: 210, h: 66, shape: 'box', color: 'logic' },
    { id: 'offers', label: 'Модуль КП и отчётов\n(1.2.5)', x: 590, y: 432, w: 210, h: 66, shape: 'box', color: 'logic' },

    { id: 'db', label: 'База данных\nPostgreSQL', x: 900, y: 200, w: 200, h: 90, shape: 'db', color: 'data' },
    { id: 'audit', label: 'Журнал действий\nпользователей', x: 900, y: 340, w: 200, h: 66, shape: 'box', color: 'data' },
    { id: 'reports', label: 'Подсистема отчётности\nи выгрузок PDF / Excel / CSV', x: 880, y: 480, w: 240, h: 80, shape: 'box', color: 'report' },
    { id: 'dict', label: 'Справочники: стадии, статусы, источники,\nтипы активностей — используются всеми модулями', x: 470, y: 580, w: 450, h: 64, shape: 'note', color: 'plain' },
  ],
  edges: [
    { from: 'user', to: 'spa', label: 'ввод данных' },
    { from: 'head', to: 'spa', label: 'запрос сводок' },
    { from: 'admin', to: 'spa' },
    { from: 'spa', to: 'auth', label: 'вход в систему' },
    { from: 'auth', to: 'spa', label: 'права доступа', dashed: true },
    { from: 'spa', to: 'clients' },
    { from: 'spa', to: 'contacts' },
    { from: 'spa', to: 'deals' },
    { from: 'spa', to: 'acts' },
    { from: 'spa', to: 'offers' },
    { from: 'clients', to: 'db' },
    { from: 'contacts', to: 'db' },
    { from: 'deals', to: 'db' },
    { from: 'acts', to: 'db' },
    { from: 'offers', to: 'db' },
    // Обход блока журнала: прямая линия прошла бы сквозь него
    {
      from: 'db', to: 'reports', label: 'агрегация',
      via: [{ x: 855, y: 245 }, { x: 855, y: 520 }],
    },
    { from: 'reports', to: 'spa', label: 'отчёты и выгрузки', dashed: true },
    // Журнал наполняется серверной логикой, поэтому связь обходит колонку
    // модулей сверху, а не пересекает её по прямой
    {
      from: 'auth', to: 'audit', label: 'записи журнала',
      via: [{ x: 555, y: 16 }, { x: 1165, y: 16 }, { x: 1165, y: 373 }],
    },
    { from: 'dict', to: 'offers', dashed: true },
  ],
};

/** 2. ER-диаграмма основных сущностей (п. 2.6.2). */
const er = {
  file: '02-er-diagramma',
  title: 'Рисунок 2 — ER-диаграмма (основные сущности CRM)',
  width: 1180,
  height: 780,
  nodes: [
    {
      id: 'audit', label: 'AuditLog\n\nPK id\nFK user_id\nentity\nentity_id\naction\npayload\ncreated_at',
      x: 40, y: 40, w: 205, h: 165, shape: 'entity', color: 'external',
    },
    {
      id: 'users', label: 'Users\n\nPK user_id\nlogin\npassword_hash\nfull_name\nrole\nis_active',
      x: 40, y: 265, w: 205, h: 150, shape: 'entity', color: 'ui',
    },
    {
      id: 'clients', label: 'Clients\n\nPK client_id\nname\ninn\nindustry\nstatus\nsource\naddress\nFK owner_user_id\ncreated_at',
      x: 330, y: 40, w: 205, h: 205, shape: 'entity', color: 'data',
    },
    {
      id: 'contacts', label: 'Contacts\n\nPK contact_id\nFK client_id\nfull_name\nposition\nphone\nemail\npreferred_channel\nnotes',
      x: 330, y: 330, w: 205, h: 190, shape: 'entity', color: 'data',
    },
    {
      id: 'deals', label: 'Deals\n\nPK deal_id\nFK client_id\ntitle\nstage\namount\ncurrency\nprobability\nplanned_close\nFK owner_user_id\nclosed_at',
      x: 620, y: 40, w: 205, h: 220, shape: 'entity', color: 'logic',
    },
    {
      id: 'acts', label: 'Activities\n\nPK activity_id\nFK client_id\nFK deal_id\ntype\nsubject\nplanned_at\ndone_at\nstatus\nresult\nFK owner_user_id',
      x: 620, y: 330, w: 205, h: 220, shape: 'entity', color: 'report',
    },
    {
      id: 'history', label: 'DealStageHistory\n\nPK id\nFK deal_id\nfrom_stage\nto_stage\nFK changed_by\nchanged_at',
      x: 915, y: 40, w: 215, h: 150, shape: 'entity', color: 'logic',
    },
    {
      id: 'offers', label: 'CommercialOffers\n\nPK offer_id\nFK deal_id\nnumber\ndate\ntotal_amount\nstatus\nfile_ref',
      x: 915, y: 330, w: 215, h: 165, shape: 'entity', color: 'report',
    },
    {
      id: 'note',
      label: 'Поле owner_user_id в таблицах Clients, Deals и Activities ссылается на Users (ответственный менеджер)\nи служит основой разграничения доступа: менеджер работает только со своими записями',
      x: 200, y: 615, w: 790, h: 66, shape: 'note', color: 'plain',
    },
  ],
  edges: [
    { from: 'users', to: 'audit', label: '1 : N' },
    { from: 'users', to: 'clients', label: '1 : N\nответственный' },
    { from: 'clients', to: 'contacts', label: '1 : N' },
    { from: 'clients', to: 'deals', label: '1 : N' },
    { from: 'clients', to: 'acts', label: '1 : N' },
    { from: 'deals', to: 'acts', label: '1 : N' },
    { from: 'deals', to: 'history', label: '1 : N' },
    { from: 'deals', to: 'offers', label: '1 : N' },
  ],
};

/** 3. SCM-диаграмма: цепочка обработки информации (п. 2.6.3). */
const scm = {
  file: '03-scm-cepochka-obrabotki',
  title: 'Рисунок 3 — SCM-диаграмма (цепочка обработки данных)',
  width: 1180,
  height: 470,
  nodes: [
    { id: 's1', label: 'Ввод и обновление\nданных', x: 40, y: 160, w: 190, h: 90, shape: 'rounded', color: 'ui' },
    { id: 's2', label: 'Проверка\nи хранение в СУБД', x: 275, y: 160, w: 190, h: 90, shape: 'rounded', color: 'data' },
    { id: 's3', label: 'Обработка:\nстадии, сроки,\nагрегация', x: 510, y: 160, w: 190, h: 90, shape: 'rounded', color: 'logic' },
    { id: 's4', label: 'Формирование\nотчётов', x: 745, y: 160, w: 190, h: 90, shape: 'rounded', color: 'report' },
    { id: 's5', label: 'Принятие решений\nруководителем\nи менеджером', x: 980, y: 160, w: 170, h: 90, shape: 'rounded', color: 'external' },

    { id: 'in1', label: 'Карточки клиентов,\nконтакты', x: 40, y: 40, w: 190, h: 62, shape: 'note', color: 'plain' },
    { id: 'in2', label: 'Сделки, активности,\nКП', x: 275, y: 40, w: 190, h: 62, shape: 'note', color: 'plain' },
    { id: 'out1', label: 'Воронка, динамика,\nактивности менеджеров', x: 745, y: 40, w: 190, h: 62, shape: 'note', color: 'plain' },
    { id: 'fb', label: 'Корректировка плана продаж и приоритетов работы с клиентами', x: 275, y: 350, w: 660, h: 56, shape: 'note', color: 'plain' },
  ],
  edges: [
    { from: 's1', to: 's2' },
    { from: 's2', to: 's3' },
    { from: 's3', to: 's4' },
    { from: 's4', to: 's5' },
    { from: 'in1', to: 's1', dashed: true },
    { from: 'in2', to: 's2', dashed: true },
    { from: 'out1', to: 's4', dashed: true },
    { from: 's5', to: 'fb', label: 'обратная связь' },
    { from: 'fb', to: 's1' },
  ],
};

/** 4. PLM-диаграмма: жизненный цикл клиента и сделки (п. 2.6.4). */
const plm = {
  file: '04-plm-zhiznennyy-cikl',
  title: 'Рисунок 4 — PLM-диаграмма (жизненный цикл клиента и сделки)',
  width: 1180,
  height: 560,
  nodes: [
    { id: 'p1', label: 'Первичный\nконтакт', x: 40, y: 180, w: 160, h: 80, shape: 'rounded', color: 'ui' },
    { id: 'p2', label: 'Квалификация', x: 240, y: 180, w: 160, h: 80, shape: 'rounded', color: 'ui' },
    { id: 'p3', label: 'Коммерческое\nпредложение', x: 440, y: 180, w: 160, h: 80, shape: 'rounded', color: 'logic' },
    { id: 'p4', label: 'Переговоры', x: 640, y: 180, w: 160, h: 80, shape: 'rounded', color: 'logic' },
    { id: 'won', label: 'Сделка\nвыиграна', x: 850, y: 80, w: 150, h: 76, shape: 'rounded', color: 'data' },
    { id: 'lost', label: 'Сделка\nпроиграна', x: 850, y: 290, w: 150, h: 76, shape: 'rounded', color: 'accent' },
    { id: 'repeat', label: 'Повторные\nпродажи', x: 1030, y: 80, w: 130, h: 76, shape: 'rounded', color: 'data' },
    { id: 'arch', label: 'Архивирование\nклиента и сделки', x: 1000, y: 290, w: 160, h: 76, shape: 'rounded', color: 'external' },
    { id: 'note', label: 'Каждый переход между стадиями фиксируется в таблице DealStageHistory\nс указанием исходной и целевой стадии, автора и времени изменения',
      x: 240, y: 430, w: 660, h: 70, shape: 'note', color: 'plain' },
  ],
  edges: [
    { from: 'p1', to: 'p2' },
    { from: 'p2', to: 'p3' },
    { from: 'p3', to: 'p4' },
    { from: 'p4', to: 'won' },
    { from: 'p4', to: 'lost' },
    // Отказы уводятся под основную цепочку: прямые линии пересекали бы
    // блоки последующих стадий
    { from: 'p2', to: 'lost', dashed: true, label: 'отказ', via: [{ x: 320, y: 300 }, { x: 790, y: 300 }] },
    { from: 'p3', to: 'lost', dashed: true, via: [{ x: 520, y: 336 }, { x: 800, y: 336 }] },
    { from: 'won', to: 'repeat' },
    // Возврат к началу цикла проводится поверх диаграммы
    {
      from: 'repeat', to: 'p1', dashed: true, label: 'новая потребность',
      via: [{ x: 1095, y: 22 }, { x: 120, y: 22 }],
    },
    { from: 'lost', to: 'arch' },
  ],
};

/** 5. MES-диаграмма: место CRM в корпоративной информационной системе (п. 2.6.5). */
const mes = {
  file: '05-mes-mesto-crm-v-kis',
  title: 'Рисунок 5 — MES-диаграмма (место CRM в КИС)',
  width: 1180,
  height: 640,
  nodes: [
    { id: 'crm', label: 'CRM\nАРМ менеджера\nпо работе с клиентами', x: 470, y: 250, w: 240, h: 120, shape: 'box', color: 'logic' },

    { id: 'erp', label: 'ERP\nучёт заказов и запасов', x: 470, y: 60, w: 240, h: 80, shape: 'box', color: 'ui' },
    { id: 'acc', label: 'Бухгалтерия\nсчета и оплаты', x: 120, y: 60, w: 220, h: 80, shape: 'box', color: 'ui' },
    { id: 'bi', label: 'Аналитика (BI)\nотчётность руководства', x: 850, y: 60, w: 220, h: 80, shape: 'box', color: 'report' },

    { id: 'tel', label: 'Телефония\nвходящие и исходящие звонки', x: 120, y: 270, w: 220, h: 80, shape: 'box', color: 'external' },
    { id: 'mail', label: 'Электронная почта\nпереписка с клиентами', x: 850, y: 270, w: 220, h: 80, shape: 'box', color: 'external' },

    { id: 'site', label: 'Сайт и заявки\nисточник лидов', x: 120, y: 470, w: 220, h: 80, shape: 'box', color: 'external' },
    { id: 'doc', label: 'Документооборот\nдоговоры и КП', x: 850, y: 470, w: 220, h: 80, shape: 'box', color: 'external' },
    { id: 'db', label: 'База данных CRM', x: 490, y: 470, w: 200, h: 76, shape: 'db', color: 'data' },
  ],
  edges: [
    // Встречные потоки разводятся по разным вертикалям, иначе линии
    // и подписи ложатся друг на друга
    { from: 'crm', to: 'erp', label: 'выигранные сделки', via: [{ x: 520, y: 200 }] },
    { from: 'erp', to: 'crm', label: 'статус отгрузки', dashed: true, via: [{ x: 665, y: 200 }] },
    { from: 'acc', to: 'crm', label: 'оплаты по счетам', dashed: true },
    { from: 'crm', to: 'bi', label: 'показатели продаж' },
    { from: 'tel', to: 'crm', label: 'история звонков' },
    { from: 'mail', to: 'crm', label: 'переписка' },
    { from: 'site', to: 'crm', label: 'лиды' },
    { from: 'crm', to: 'doc', label: 'КП и договоры' },
    { from: 'crm', to: 'db' },
  ],
};

/** 6. IDEF0-диаграмма, функция A0 (п. 2.6.6). */
const idef0 = {
  file: '06-idef0-funkciya-a0',
  title: 'Рисунок 6 — IDEF0-диаграмма (функция A0)',
  width: 1180,
  height: 640,
  nodes: [
    { id: 'a0', label: 'A0\nВести учёт взаимодействий\nс клиентами и контроль сделок', x: 420, y: 250, w: 340, h: 140, shape: 'box', color: 'logic' },

    { id: 'in', label: 'ВХОД\n\n· данные о клиентах и контактах\n· события: звонки, встречи, письма\n· параметры сделок и КП',
      x: 40, y: 245, w: 300, h: 150, shape: 'note', color: 'ui' },
    { id: 'out', label: 'ВЫХОД\n\n· история взаимодействий\n· отчёты по продажам и активностям\n· документы: КП, выгрузки',
      x: 840, y: 245, w: 300, h: 150, shape: 'note', color: 'data' },
    { id: 'ctrl', label: 'УПРАВЛЕНИЕ\n\n· регламент работы отдела продаж\n· права доступа по ролям\n· справочники стадий и статусов',
      x: 420, y: 40, w: 340, h: 140, shape: 'note', color: 'report' },
    { id: 'mech', label: 'МЕХАНИЗМЫ\n\n· менеджер, руководитель, администратор\n· web-интерфейс АРМ · сервер приложений\n· СУБД PostgreSQL',
      x: 420, y: 460, w: 340, h: 140, shape: 'note', color: 'external' },
  ],
  edges: [
    { from: 'in', to: 'a0' },
    { from: 'a0', to: 'out' },
    { from: 'ctrl', to: 'a0' },
    { from: 'mech', to: 'a0' },
  ],
};

export const DIAGRAMS = [modules, er, scm, plm, mes, idef0];
