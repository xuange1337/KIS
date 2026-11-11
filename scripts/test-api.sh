#!/usr/bin/env bash
# Прогон API-тестов на локальной базе crm_test (контейнер crm-db, порт 5432).
# Использование: scripts/test-api.sh [шаблон-имени-теста]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
unset NODE_ENV
POSTGRES_HOST=localhost POSTGRES_DB=crm_test npm run test:api -- "$@"
