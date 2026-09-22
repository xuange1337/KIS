#!/usr/bin/env bash
#
# Браузерные проверки по собранному стенду.
#
# Поднимает стенд и прогоняет Playwright. Предел попыток входа поднят:
# каждый сценарий входит заново, а обычные пять попыток в минуту с адреса
# отсекают уже третий сценарий. Это настройка стенда, а не обход защиты —
# в рабочем развёртывании предел остаётся прежним.
set -euo pipefail

cd "$(dirname "$0")/.."

export LOGIN_RATE_LIMIT="${LOGIN_RATE_LIMIT:-200}"
BASE_URL="${E2E_BASE_URL:-http://localhost:8080}"

log() { printf '[browser-e2e] %s\n' "$*"; }

log 'Сборка и запуск стенда'
docker compose up --build -d

log 'Ожидание готовности'
for _ in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/api/health/ready" >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS "${BASE_URL}/api/health/ready" >/dev/null

# Наполнение нужно, иначе сценарии не на чем выполнять
USERS_COUNT="$(docker compose exec -T db psql --username "${POSTGRES_USER:-crm}" \
  --dbname "${POSTGRES_DB:-crm}" --tuples-only --no-align \
  --command 'SELECT count(*) FROM users' 2>/dev/null | tr -d '[:space:]')"
if [ "${USERS_COUNT:-0}" = "0" ]; then
  log 'База пуста: наполнение демонстрационными данными'
  docker compose exec -T api node dist/database/seeds/seed.js >/dev/null
fi

log 'Прогон сценариев'
E2E_BASE_URL="$BASE_URL" npx playwright test "$@"
