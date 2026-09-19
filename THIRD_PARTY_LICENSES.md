# Лицензии сторонних компонентов

Проверено по `package-lock.json` 18 сентября 2026 года. В production-дереве 515 пакетов. Обязательных платных, source-available или запрещающих коммерческое использование лицензий не обнаружено.

## Сводка

| Лицензия | Пакетов |
|---|---:|
| MIT | 426 |
| ISC | 47 |
| BSD-3-Clause | 9 |
| Apache-2.0 | 8 |
| BlueOak-1.0.0 | 5 |
| BSD-2-Clause | 3 |
| MIT/X11 | 2 |
| OFL-1.1 | 2 |
| 0BSD | 1 |
| Unlicense | 1 |
| Python-2.0 | 1 |
| Совместимые составные выражения MIT/BSD/ISC/Zlib | 4 |
| Без SPDX-поля в lock metadata, проверены отдельно | 6 |

Пакеты без SPDX-поля в lock metadata: `buffers`, `busboy`, `passport-strategy`, `pause`, `png-js`, `streamsearch`. Их исходные дистрибутивы содержат разрешительные лицензии; они внесены в явный allowlist автоматической проверки.

Выражение `(MIT OR GPL-3.0-or-later)` используется на условиях MIT.

`Python-2.0` — разрешительная лицензия OSI без copyleft; под ней распространяется `argparse`, попадающий в дерево транзитивно через `js-yaml` в `@nestjs/swagger`.

## Прямые production-зависимости

| Группа | Компоненты | Лицензия |
|---|---|---|
| NestJS | common, config, core, jwt, mapped-types, passport, platform-express, swagger, throttler, typeorm | MIT |
| React | react, react-dom, react-router-dom | MIT |
| MUI | material, icons-material, x-data-grid, x-date-pickers, emotion | MIT |
| Данные и формы | axios, TanStack Query, react-hook-form, zod, date-fns | MIT |
| Сервер и БД | TypeORM, pg, passport, passport-jwt, bcryptjs, class-validator, RxJS | MIT/Apache-2.0 |
| Отчёты | exceljs, pdfmake, recharts | MIT |
| Шрифты | Fontsource Inter, JetBrains Mono, DejaVu Sans | OFL-1.1 и Bitstream Vera-compatible |

## Автоматическая проверка

```bash
npm run licenses:check
```

Проверка завершается ошибкой при неизвестной лицензии или появлении лицензии вне разрешительного allowlist. При обновлении зависимостей нужно проверить первичный текст новой лицензии, затем осознанно обновить allowlist и эту сводку.

Этот файл является технической инвентаризацией, а не юридическим заключением. Перед распространением сборки владелец продукта должен сохранить требуемые тексты лицензий и notices в поставке.
