-- =============================================================================
-- АРМ менеджера по работе с клиентами в CRM-системе
-- Структура базы данных (Приложение А описания прикладной программы)
--
-- СУБД: PostgreSQL 17
-- Документационная форма схемы: соответствует миграции TypeORM
-- server/src/database/migrations/*-InitSchema.ts, но записана с явными
-- именами ограничений и комментариями к таблицам и полям.
--
-- Порядок создания объектов учитывает зависимости по внешним ключам:
-- organizations -> users -> clients -> contacts -> deals ->
-- deal_stage_history/activities/offers
--
-- Организация — граница изоляции данных: каждая бизнес-запись принадлежит
-- ровно одной организации, и все выборки приложения ограничены
-- организацией текущего пользователя.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Перечислимые типы (справочники системы)
-- -----------------------------------------------------------------------------

-- Роли пользователей: менеджер, руководитель отдела продаж, администратор
CREATE TYPE user_role AS ENUM ('manager', 'head', 'admin');

-- Статус клиента в работе отдела продаж
CREATE TYPE client_status AS ENUM ('lead', 'in_work', 'active', 'archived');

-- Источник появления клиента
CREATE TYPE client_source AS ENUM (
    'website', 'call', 'exhibition', 'partner', 'advertising', 'recommendation'
);

-- Предпочитаемый канал связи с контактным лицом
CREATE TYPE preferred_channel AS ENUM ('phone', 'email', 'messenger');

-- Стадии сделки. Порядок соответствует жизненному циклу сделки
-- на PLM-диаграмме (п. 2.6.4) и используется для построения воронки продаж
CREATE TYPE deal_stage AS ENUM (
    'new', 'qualification', 'proposal', 'negotiation', 'won', 'lost'
);

CREATE TYPE currency_code AS ENUM ('RUB', 'USD', 'EUR');

-- Тип активности: звонок, встреча, письмо
CREATE TYPE activity_type AS ENUM ('call', 'meeting', 'email');

CREATE TYPE activity_status AS ENUM ('planned', 'done', 'canceled');

-- Статус коммерческого предложения
CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

-- Действие, фиксируемое в журнале
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'export');


-- -----------------------------------------------------------------------------
-- Organizations — организации-арендаторы
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
    organization_id SERIAL       PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_name ON organizations (name);

COMMENT ON TABLE organizations IS
    'Организация-арендатор: граница изоляции всех бизнес-данных';


-- -----------------------------------------------------------------------------
-- Users — пользователи системы
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    user_id         SERIAL     PRIMARY KEY,
    organization_id INTEGER    NOT NULL REFERENCES organizations (organization_id)
                               ON DELETE RESTRICT,
    login         VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(160) NOT NULL,
    role          user_role    NOT NULL DEFAULT 'manager',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_login UNIQUE (login)
);

CREATE UNIQUE INDEX idx_users_login ON users (login);
CREATE INDEX idx_users_organization ON users (organization_id);

-- Логин уникален во всей системе, а не внутри организации: страница входа
-- одна, и по одному логину не должно находиться двух учётных записей

COMMENT ON TABLE  users               IS 'Пользователи АРМ: менеджеры, руководитель, администратор';
COMMENT ON COLUMN users.password_hash IS 'Хеш пароля (bcrypt), в открытом виде пароль не хранится';
COMMENT ON COLUMN users.is_active     IS 'Признак активности; вместо удаления учётная запись блокируется';


-- -----------------------------------------------------------------------------
-- Clients — карточки клиентов (модуль 1.2.1)
-- -----------------------------------------------------------------------------
CREATE TABLE clients (
    client_id     SERIAL        PRIMARY KEY,
    organization_id INTEGER  NOT NULL REFERENCES organizations (organization_id)
                             ON DELETE RESTRICT,
    name          VARCHAR(255)  NOT NULL,
    inn           VARCHAR(12),
    industry      VARCHAR(120),
    status        client_status NOT NULL DEFAULT 'lead',
    source        client_source,
    address       VARCHAR(255),
    owner_user_id INTEGER,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_clients_owner FOREIGN KEY (owner_user_id)
        REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_clients_organization ON clients (organization_id);

CREATE INDEX idx_clients_name  ON clients (name);
CREATE INDEX idx_clients_owner ON clients (owner_user_id);

COMMENT ON TABLE  clients               IS 'Клиентская база: организации и лиды';
COMMENT ON COLUMN clients.inn           IS 'ИНН: 10 цифр для организации, 12 для ИП; поле необязательное';
COMMENT ON COLUMN clients.owner_user_id IS 'Ответственный менеджер; основа разграничения доступа по ролям';


-- -----------------------------------------------------------------------------
-- Contacts — контактные лица клиентов (модуль 1.2.2)
-- -----------------------------------------------------------------------------
CREATE TABLE contacts (
    contact_id        SERIAL       PRIMARY KEY,
    organization_id INTEGER  NOT NULL REFERENCES organizations (organization_id)
                             ON DELETE RESTRICT,
    client_id         INTEGER      NOT NULL,
    full_name         VARCHAR(160) NOT NULL,
    position          VARCHAR(120),
    phone             VARCHAR(32),
    email             VARCHAR(160),
    preferred_channel preferred_channel,
    notes             TEXT,

    CONSTRAINT fk_contacts_client FOREIGN KEY (client_id)
        REFERENCES clients (client_id) ON DELETE CASCADE
);

CREATE INDEX idx_contacts_organization ON contacts (organization_id);

CREATE INDEX idx_contacts_client ON contacts (client_id);

COMMENT ON TABLE  contacts                   IS 'Контактные лица клиентов';
COMMENT ON COLUMN contacts.preferred_channel IS 'Предпочитаемый способ связи, учитывается при планировании активностей';


-- -----------------------------------------------------------------------------
-- Deals — сделки (модуль 1.2.3)
-- -----------------------------------------------------------------------------
CREATE TABLE deals (
    deal_id       SERIAL         PRIMARY KEY,
    organization_id INTEGER  NOT NULL REFERENCES organizations (organization_id)
                             ON DELETE RESTRICT,
    client_id     INTEGER        NOT NULL,
    title         VARCHAR(255)   NOT NULL,
    stage         deal_stage     NOT NULL DEFAULT 'new',
    amount        NUMERIC(14, 2) NOT NULL DEFAULT 0,
    currency      currency_code  NOT NULL DEFAULT 'RUB',
    probability   SMALLINT       NOT NULL DEFAULT 0,
    planned_close DATE,
    owner_user_id INTEGER,
    closed_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_deals_client FOREIGN KEY (client_id)
        REFERENCES clients (client_id) ON DELETE RESTRICT,
    CONSTRAINT fk_deals_owner FOREIGN KEY (owner_user_id)
        REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT ck_deals_probability CHECK (probability BETWEEN 0 AND 100),
    CONSTRAINT ck_deals_amount CHECK (amount >= 0)
);

CREATE INDEX idx_deals_organization ON deals (organization_id);

CREATE INDEX idx_deals_stage_owner ON deals (stage, owner_user_id);
CREATE INDEX idx_deals_closed_at   ON deals (closed_at);
-- Разграничение доступа фильтрует по одному owner_user_id, поэтому
-- составного индекса с ведущей колонкой stage для этого недостаточно
CREATE INDEX idx_deals_owner       ON deals (owner_user_id);

COMMENT ON TABLE  deals             IS 'Сделки отдела продаж';
COMMENT ON COLUMN deals.probability IS 'Вероятность закрытия, %; подставляется по стадии сделки';
COMMENT ON COLUMN deals.closed_at   IS 'Дата закрытия; заполняется при переходе на стадию won или lost';


-- -----------------------------------------------------------------------------
-- DealStageHistory — история смены стадий сделки
-- Обеспечивает требование «история изменений» (п. 1.2.3, п. 2.3)
-- -----------------------------------------------------------------------------
CREATE TABLE deal_stage_history (
    id         SERIAL      PRIMARY KEY,
    organization_id INTEGER  NOT NULL REFERENCES organizations (organization_id)
                             ON DELETE RESTRICT,
    deal_id    INTEGER     NOT NULL,
    from_stage deal_stage,
    to_stage   deal_stage  NOT NULL,
    changed_by INTEGER,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_stage_history_deal FOREIGN KEY (deal_id)
        REFERENCES deals (deal_id) ON DELETE CASCADE,
    CONSTRAINT fk_stage_history_user FOREIGN KEY (changed_by)
        REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_deal_stage_history_organization ON deal_stage_history (organization_id);

CREATE INDEX idx_stage_history_deal ON deal_stage_history (deal_id);

COMMENT ON TABLE  deal_stage_history            IS 'Журнал перемещения сделок по воронке продаж';
COMMENT ON COLUMN deal_stage_history.from_stage IS 'NULL означает запись о создании сделки';


-- -----------------------------------------------------------------------------
-- Activities — активности: звонки, встречи, письма (модуль 1.2.4)
-- -----------------------------------------------------------------------------
CREATE TABLE activities (
    activity_id   SERIAL          PRIMARY KEY,
    organization_id INTEGER  NOT NULL REFERENCES organizations (organization_id)
                             ON DELETE RESTRICT,
    client_id     INTEGER         NOT NULL,
    deal_id       INTEGER,
    type          activity_type   NOT NULL,
    subject       VARCHAR(255)    NOT NULL,
    planned_at    TIMESTAMPTZ     NOT NULL,
    done_at       TIMESTAMPTZ,
    status        activity_status NOT NULL DEFAULT 'planned',
    result        TEXT,
    comment       TEXT,
    owner_user_id INTEGER,

    CONSTRAINT fk_activities_client FOREIGN KEY (client_id)
        REFERENCES clients (client_id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_deal FOREIGN KEY (deal_id)
        REFERENCES deals (deal_id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_owner FOREIGN KEY (owner_user_id)
        REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE INDEX idx_activities_organization ON activities (organization_id);

-- Индекс покрывает выборки календаря и отчёт о просроченных активностях
CREATE INDEX idx_activities_planning ON activities (planned_at, owner_user_id, status);
-- Отдельные индексы под разграничение доступа, фильтры карточек
-- и каскадное удаление по внешним ключам
CREATE INDEX idx_activities_owner  ON activities (owner_user_id);
CREATE INDEX idx_activities_client ON activities (client_id);
CREATE INDEX idx_activities_deal   ON activities (deal_id);

COMMENT ON TABLE  activities            IS 'Планируемые и выполненные коммуникации с клиентами';
COMMENT ON COLUMN activities.deal_id    IS 'Необязательная привязка к сделке';
COMMENT ON COLUMN activities.planned_at IS 'Плановые дата и время; просроченной считается planned_at < NOW() при status = planned';
COMMENT ON COLUMN activities.result     IS 'Результат коммуникации, заполняется при отметке о выполнении';


-- -----------------------------------------------------------------------------
-- CommercialOffers — коммерческие предложения (модуль 1.2.5)
-- -----------------------------------------------------------------------------
CREATE TABLE commercial_offers (
    offer_id     SERIAL         PRIMARY KEY,
    organization_id INTEGER  NOT NULL REFERENCES organizations (organization_id)
                             ON DELETE RESTRICT,
    deal_id      INTEGER        NOT NULL,
    number       VARCHAR(64)    NOT NULL,
    date         DATE           NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status       offer_status   NOT NULL DEFAULT 'draft',
    file_ref     VARCHAR(255),

    CONSTRAINT fk_offers_deal FOREIGN KEY (deal_id)
        REFERENCES deals (deal_id) ON DELETE CASCADE,
    CONSTRAINT ck_offers_amount CHECK (total_amount >= 0)
);

CREATE INDEX idx_commercial_offers_organization ON commercial_offers (organization_id);

CREATE INDEX idx_offers_deal ON commercial_offers (deal_id);

COMMENT ON TABLE  commercial_offers          IS 'Коммерческие предложения и счета по сделкам';
COMMENT ON COLUMN commercial_offers.file_ref IS 'Ссылка на файл вложения во внутреннем хранилище uploads/';


-- -----------------------------------------------------------------------------
-- AuditLog — журнал действий пользователей
-- Обеспечивает требование журналирования действий (п. 1.1)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
    id         SERIAL       PRIMARY KEY,
    -- NULL допустим: неудачный вход записывается до того, как известна
    -- учётная запись, и не относится ни к какой организации
    organization_id INTEGER REFERENCES organizations (organization_id)
                            ON DELETE RESTRICT,
    user_id    INTEGER,
    entity     VARCHAR(64)  NOT NULL,
    entity_id  VARCHAR(64),
    action     audit_action NOT NULL,
    payload    JSONB,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user             ON audit_log (user_id);
CREATE INDEX idx_audit_log_organization ON audit_log (organization_id);
CREATE INDEX idx_audit_created ON audit_log (created_at);

COMMENT ON TABLE  audit_log         IS 'Журнал изменяющих операций и входов в систему';
COMMENT ON COLUMN audit_log.entity  IS 'Имя сущности: clients, deals, activities, offers, users';
COMMENT ON COLUMN audit_log.payload IS 'Параметры запроса; пароли исключаются при записи';


-- =============================================================================
-- Запросы, лежащие в основе отчётов (п. 2.4)
-- =============================================================================

-- Во всех запросах ниже подразумевается ограничение организацией текущего
-- пользователя: WHERE organization_id = :organizationId. Приложение
-- добавляет его централизованно (server/src/common/helpers/tenant-scope.ts).

-- 1. Воронка продаж: количество и сумма сделок по стадиям
--    SELECT stage, COUNT(*), SUM(amount) FROM deals GROUP BY stage;

-- 2. Динамика продаж: сумма закрытых сделок по месяцам
--    SELECT DATE_TRUNC('month', closed_at), COUNT(*), SUM(amount)
--    FROM deals WHERE stage = 'won' GROUP BY 1 ORDER BY 1;

-- 3. Активности менеджеров: количество коммуникаций по сотрудникам и типам
--    SELECT u.full_name,
--           COUNT(*) FILTER (WHERE a.type = 'call')    AS calls,
--           COUNT(*) FILTER (WHERE a.type = 'meeting') AS meetings,
--           COUNT(*) FILTER (WHERE a.type = 'email')   AS emails
--    FROM activities a JOIN users u ON u.user_id = a.owner_user_id
--    GROUP BY u.full_name;

-- 4. Просроченные активности
--    SELECT * FROM activities WHERE status = 'planned' AND planned_at < NOW();

-- 5. ТОП клиентов по сумме сделок
--    SELECT c.name, COUNT(d.deal_id), SUM(d.amount)
--    FROM clients c JOIN deals d ON d.client_id = c.client_id
--    GROUP BY c.name ORDER BY 3 DESC LIMIT 10;
