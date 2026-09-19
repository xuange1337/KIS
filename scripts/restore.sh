#!/usr/bin/env bash
#
# Восстановление из резервной копии.
#
# По умолчанию восстанавливает в отдельную базу проверки, а не поверх
# рабочей: непроверенная копия ничем не лучше её отсутствия, и убедиться
# в пригодности нужно раньше аварии. Восстановление рабочей базы —
# явное действие с подтверждением.
#
# Использование:
#   scripts/restore.sh <каталог-копии> [--verify | --into <база> | --production]
#
# Переменные окружения:
#   BACKUP_PASSPHRASE  парольная фраза, если копия зашифрована
set -euo pipefail

cd "$(dirname "$0")/.."

SOURCE="${1:?Укажите каталог копии: scripts/restore.sh backups/20260919-120000}"
MODE="${2:---verify}"

POSTGRES_USER="${POSTGRES_USER:-crm}"
POSTGRES_DB="${POSTGRES_DB:-crm}"
TARGET_DB="restore_check"

log() { printf '[restore] %s\n' "$*"; }
fail() { printf '[restore] ОШИБКА: %s\n' "$*" >&2; exit 1; }

case "$MODE" in
  --verify) ;;
  --into) TARGET_DB="${3:?Укажите имя базы после --into}" ;;
  --production)
    TARGET_DB="$POSTGRES_DB"
    printf 'Рабочая база «%s» будет заменена копией %s.\n' "$TARGET_DB" "$SOURCE"
    printf 'Введите имя базы для подтверждения: '
    read -r CONFIRM
    [ "$CONFIRM" = "$TARGET_DB" ] || fail 'Подтверждение не совпало, ничего не изменено'
    ;;
  *) fail "Неизвестный режим: $MODE" ;;
esac

[ -d "$SOURCE" ] || fail "Каталог копии не найден: $SOURCE"

log "Проверка контрольных сумм"
( cd "$SOURCE" && { shasum -a 256 -c SHA256SUMS >/dev/null 2>&1 || sha256sum -c SHA256SUMS >/dev/null; } ) \
  || fail 'Контрольные суммы не сходятся: копия повреждена'

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -f "${SOURCE}/database.dump.enc" ]; then
  [ -n "${BACKUP_PASSPHRASE:-}" ] || fail 'Копия зашифрована, задайте BACKUP_PASSPHRASE'
  log "Расшифровка"
  openssl enc -d -aes-256-cbc -pbkdf2 -in "${SOURCE}/database.dump.enc" \
    -out "${WORK}/database.dump" -pass env:BACKUP_PASSPHRASE
  openssl enc -d -aes-256-cbc -pbkdf2 -in "${SOURCE}/uploads.tar.enc" \
    -out "${WORK}/uploads.tar" -pass env:BACKUP_PASSPHRASE
else
  cp "${SOURCE}/database.dump" "${WORK}/database.dump"
  cp "${SOURCE}/uploads.tar" "${WORK}/uploads.tar"
fi

log "Целевая база: ${TARGET_DB}"
docker compose exec -T db psql --username "$POSTGRES_USER" --dbname postgres \
  --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
             WHERE datname = '${TARGET_DB}' AND pid <> pg_backend_pid()" >/dev/null
docker compose exec -T db psql --username "$POSTGRES_USER" --dbname postgres \
  --command "DROP DATABASE IF EXISTS \"${TARGET_DB}\"" >/dev/null
docker compose exec -T db psql --username "$POSTGRES_USER" --dbname postgres \
  --command "CREATE DATABASE \"${TARGET_DB}\"" >/dev/null

log "Восстановление дампа"
docker compose exec -T db pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$TARGET_DB" \
  --no-owner \
  --exit-on-error < "${WORK}/database.dump"

log "Проверка содержимого"
# Пустая, но синтаксически корректная база — типичный результат
# «успешного» восстановления сломанной копии, поэтому считаем строки
COUNTS="$(docker compose exec -T db psql --username "$POSTGRES_USER" --dbname "$TARGET_DB" \
  --tuples-only --no-align --field-separator=' ' \
  --command "SELECT
     (SELECT count(*) FROM organizations),
     (SELECT count(*) FROM users),
     (SELECT count(*) FROM clients),
     (SELECT count(*) FROM deals)")"
read -r ORGS USERS CLIENTS DEALS <<< "$COUNTS"
log "Организаций ${ORGS}, пользователей ${USERS}, клиентов ${CLIENTS}, сделок ${DEALS}"
[ "$ORGS" -gt 0 ] && [ "$USERS" -gt 0 ] || fail 'Восстановленная база пуста'

SCHEMA_IN_BACKUP="$(cat "${SOURCE}/schema-version.txt" 2>/dev/null | tr -d '[:space:]')"
SCHEMA_RESTORED="$(docker compose exec -T db psql --username "$POSTGRES_USER" \
  --dbname "$TARGET_DB" --tuples-only --no-align \
  --command "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1" | tr -d '[:space:]')"
[ "$SCHEMA_IN_BACKUP" = "$SCHEMA_RESTORED" ] \
  || fail "Версия схемы разошлась: в копии ${SCHEMA_IN_BACKUP}, восстановлено ${SCHEMA_RESTORED}"
log "Версия схемы совпадает: ${SCHEMA_RESTORED}"

if [ "$MODE" = "--production" ]; then
  log "Восстановление файлов вложений"
  docker compose exec -T api tar -xf - -C /app < "${WORK}/uploads.tar"
  log 'Готово. Перезапустите api: docker compose restart api'
else
  log "Файлы вложений не распаковывались: режим проверки"
  log "Проверочная база «${TARGET_DB}» оставлена для осмотра"
  log "Удалить: docker compose exec -T db dropdb -U ${POSTGRES_USER} ${TARGET_DB}"
fi
