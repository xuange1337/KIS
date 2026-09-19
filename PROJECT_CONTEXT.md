# Контекст проекта KIS CRM

## Назначение

Учебная CRM для ведения клиентов, контактов, сделок, активностей, коммерческих предложений и отчётов. Интерфейс и предметная область русскоязычные.

## Стек

- Монорепозиторий npm workspaces, Node.js 20+
- `web`: React 18, TypeScript, Vite, MUI, TanStack Query, React Hook Form, Zod, Recharts
- `server`: NestJS 11, TypeORM, PostgreSQL 17, JWT
- `packages/shared`: общие типы, enum и подписи сущностей
- Docker Compose: PostgreSQL, API, nginx со SPA

## Структура

```text
KIS/
├── packages/shared/src/       общие DTO-типы, enum и константы
├── server/src/
│   ├── organizations/         организации: граница изоляции данных
│   ├── auth/                  вход, refresh-cookie, текущий пользователь
│   ├── users/                 пользователи и роли
│   ├── clients/               клиенты
│   ├── contacts/              контакты клиентов
│   ├── deals/                 сделки и история стадий
│   ├── activities/            звонки, встречи, письма и календарь
│   ├── offers/                коммерческие предложения
│   ├── reports/               5 отчётов и экспорт CSV/XLSX/PDF
│   ├── dashboard/             сводка главной страницы
│   ├── dictionaries/          справочники для форм
│   ├── common/                guards, decorators, audit, pagination
│   ├── config/                переменные окружения
│   └── database/              TypeORM, миграции и seed
├── server/test/               e2e-тесты API
├── web/src/
│   ├── api/                   Axios-клиент и query/mutation hooks
│   ├── components/            общие UI-компоненты
│   ├── features/              формы и сложные виджеты по сущностям
│   ├── pages/                 страницы маршрутов
│   ├── routes/                маршрутизация и проверка ролей
│   ├── theme/                 тема и дизайн-токены
│   └── test/                  настройка Vitest
├── docs/schema.sql            схема БД и запросы отчётов
├── docs/diagrams/             исходники и рендеры диаграмм
├── docs/screenshots/          готовые экранные формы
├── docker-compose.yml         production-подобный локальный запуск
└── README.md                  полное описание, ТЗ и демонстрационные данные
```

## Карта изменений

- Новая сущность или поле: `packages/shared` → entity/DTO/service/controller в `server` → migration → hooks/forms/pages в `web` → тесты.
- Бизнес-логика API находится в `*.service.ts`, HTTP-контракт — в `*.controller.ts` и `dto/`.
- Клиентские API-вызовы централизованы в `web/src/api/hooks.ts`; Axios и refresh токена — в `web/src/api/client.ts`.
- Роуты страниц находятся в `web/src/routes/index.tsx`.
- Источник общих enum и типов — только `packages/shared/src/`; не дублировать их в `web` или `server`.
- Схему БД менять только миграциями; `synchronize` отключён.

## Основные маршруты

| URL | Раздел |
|---|---|
| `/` | дашборд |
| `/clients`, `/clients/:id` | клиенты и карточка клиента |
| `/deals`, `/deals/:id` | сделки и карточка сделки |
| `/calendar` | активности |
| `/offers` | коммерческие предложения |
| `/reports` | отчёты |
| `/users` | пользователи, только администратор |

API имеет префикс `/api`. Модули API повторяют названия каталогов `server/src`; полный список endpoints проще получать командой:

```bash
rg -n '@(Controller|Get|Post|Patch|Delete)\(' server/src --glob '*.controller.ts'
```

## Важные правила предметной области

- Каждая бизнес-запись принадлежит организации (`organization_id`). Любая выборка проходит через `server/src/common/helpers/tenant-scope.ts`; чужая запись отдаётся как 404. Организация берётся из записи пользователя, а не из токена.
- Логин уникален во всей системе, а не внутри организации: страница входа одна.
- Роли: `manager`, `head`, `admin`. Роль действует внутри организации пользователя.
- Менеджер видит только свои записи; руководитель и администратор — весь отдел. Общая фильтрация: `server/src/common/helpers/owner-scope.ts`.
- Access token хранится в памяти, refresh token — в httpOnly cookie.
- Стадия сделки меняется через `PATCH /api/deals/:id/stage`; операция транзакционно пишет историю.
- Вероятность сделки определяется стадией.
- Клиента со сделками не удаляют, а архивируют. Каскадное удаление требует явного `force=true` там, где разрешено.
- Суммы разных валют не складываются; отчёты считают выбранную валюту, по умолчанию RUB.
- Границы отчётных периодов зависят от `TZ`, по умолчанию `Europe/Moscow`.
- Все маршруты закрыты JWT, кроме помеченных `@Public()`; изменяющие операции журналируются.
- Формат ответа об ошибке единый: `statusCode`, `code`, `message`, `path`, `requestId`, `timestamp` плюс поля самого исключения.
- Контракт API описан в `docs/openapi.json`; после изменения маршрутов или DTO обновлять командой `npm run openapi`.

## Команды

```bash
npm install
npm run build:shared
npm run dev:api
npm run dev:web
npm run test:web
POSTGRES_HOST=localhost npm run test:api
POSTGRES_HOST=localhost npm run migration:run -w @crm/server
POSTGRES_HOST=localhost npm run seed -w @crm/server
docker compose up --build -d
```

Для локальной разработки нужны заполненные `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` и параметры PostgreSQL в `.env`. Web работает на `5173`, API на `3000`, Docker-сборка — на `8080`.

## Быстрый поиск

```bash
rg --files server/src web/src packages/shared/src
rg 'искомый_символ' server/src web/src packages/shared/src
```

Не читать без необходимости `node_modules/`, `dist/`, `package-lock.json`, бинарные файлы `docs/screenshots/` и рендеры `.png`/`.svg`. Они установочные, сгенерированные или справочные. Для общей картины сначала использовать этот файл; подробности ТЗ и демонстрации брать из `README.md`, точную реализацию — из исходников.

## Проверка изменений

Полная проверка одной командой: `POSTGRES_HOST=localhost npm run ci`.
Проверка собранной системы: `npm run smoke`.


- Контракт API: `POSTGRES_HOST=localhost npm run openapi` (файл `docs/openapi.json` в репозитории)
- Shared: `npm run build:shared`
- Frontend: `npm run test:web && npm run build -w @crm/web`
- Backend: `npm run build -w @crm/server`
- Изменения API/БД: дополнительно `POSTGRES_HOST=localhost npm run test:api`
