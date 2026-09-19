#!/usr/bin/env bash
#
# Production smoke test: сборка образов, запуск, проверка живой системы.
#
# Проверяет то, что не проверяют e2e: образы собираются, контейнеры
# доходят до healthy, миграции применяются на пустых томах, а собранный
# фронтенд отдаётся nginx. Именно здесь ловятся ошибки сборки образа и
# конфигурации, которых нет при запуске из исходников.
#
# Использование:
#   scripts/smoke.sh            проверка на текущих данных
#   scripts/smoke.sh --clean    на чистых томах (данные удаляются!)
set -euo pipefail

cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-http://localhost:8080}"
MODE="${1:-}"
POSTGRES_USER="${POSTGRES_USER:-crm}"
POSTGRES_DB="${POSTGRES_DB:-crm}"

log() { printf '[smoke] %s\n' "$*"; }
fail() { printf '[smoke] ОШИБКА: %s\n' "$*" >&2; exit 1; }

if [ "$MODE" = "--clean" ]; then
  printf 'Тома будут удалены вместе со всеми данными. Введите «удалить»: '
  read -r CONFIRM
  [ "$CONFIRM" = "удалить" ] || fail 'Подтверждение не совпало'
  docker compose down -v
fi

log 'Сборка и запуск'
docker compose up --build -d

log 'Ожидание готовности'
for _ in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/api/health/ready" >/dev/null 2>&1; then break; fi
  sleep 2
done

READY="$(curl -fsS "${BASE_URL}/api/health/ready")" || fail 'Готовность не подтверждена'
echo "$READY" | grep -q '"schema":"current"' || fail "Схема не актуальна: ${READY}"
log "Готовность: ${READY}"

# Наполнение зависит от того, пуста ли база, а не от флага запуска:
# на чистом окружении (в том числе в CI) миграции создают схему, но
# пользователей в ней нет, и проверка входа падала бы с 401
USERS_COUNT="$(docker compose exec -T db psql --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" --tuples-only --no-align \
  --command 'SELECT count(*) FROM users' 2>/dev/null | tr -d '[:space:]')"
if [ "${USERS_COUNT:-0}" = "0" ]; then
  log 'База пуста: наполнение демонстрационными данными'
  docker compose exec -T api node dist/database/seeds/seed.js >/dev/null
else
  log "В базе ${USERS_COUNT} учётных записей, наполнение не требуется"
fi

log 'Вход'
LOGIN="$(curl -fsS -X POST "${BASE_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"login":"manager","password":"manager123"}')" || fail 'Вход не выполнен'
TOKEN="$(printf '%s' "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
[ -n "$TOKEN" ] || fail 'Токен не получен'

log 'Данные и отчёты'
curl -fsS "${BASE_URL}/api/clients?limit=1" -H "Authorization: Bearer ${TOKEN}" \
  | grep -q '"items"' || fail 'Список клиентов не отдан'
curl -fsS "${BASE_URL}/api/reports/funnel" -H "Authorization: Bearer ${TOKEN}" \
  | grep -q 'stage' || fail 'Отчёт не построен'

log 'Формат ошибки'
curl -sS "${BASE_URL}/api/clients" | grep -q '"requestId"' \
  || fail 'Ответ об ошибке не в едином формате'

log 'Документация API'
curl -fsS -o /dev/null "${BASE_URL}/api/docs/openapi.json" || fail 'OpenAPI недоступен'

log 'Интерфейс'
curl -fsS "${BASE_URL}/" | grep -qi '<div id="root"' || fail 'SPA не отдаётся'

log 'Все проверки пройдены'
