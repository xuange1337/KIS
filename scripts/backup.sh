#!/usr/bin/env bash
#
# Резервная копия базы данных и файлов.
#
# Копия снимается через контейнеры compose, поэтому клиент PostgreSQL
# на хосте не нужен и версия клиента заведомо совпадает с сервером.
# Формат дампа — custom (-Fc): он сжат, восстанавливается параллельно
# и допускает выборочное восстановление отдельных таблиц.
#
# Использование:
#   scripts/backup.sh [каталог]
#
# Переменные окружения:
#   BACKUP_DIR         каталог копий (по умолчанию ./backups)
#   BACKUP_KEEP_DAYS   срок хранения в днях (по умолчанию 14)
#   BACKUP_PASSPHRASE  задана — копия шифруется AES-256
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${1:-${BACKUP_DIR:-backups}}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/${STAMP}"

POSTGRES_USER="${POSTGRES_USER:-crm}"
POSTGRES_DB="${POSTGRES_DB:-crm}"

log() { printf '[backup] %s\n' "$*"; }

mkdir -p "$TARGET"

log "База данных: ${POSTGRES_DB}"
# Дамп идёт в stdout контейнера и пишется на хост: внутри контейнера
# лишний файл не остаётся и место в образе не занимает
docker compose exec -T db pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  > "${TARGET}/database.dump"

log "Файлы вложений"
# Том с вложениями монтируется в api; tar сохраняет права и пустые каталоги
docker compose exec -T api tar -cf - -C /app uploads > "${TARGET}/uploads.tar"

# Версия схемы: без неё нельзя понять, каким кодом копия восстанавливается
docker compose exec -T db psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --tuples-only --no-align \
  --command "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1" \
  > "${TARGET}/schema-version.txt"

if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  log "Шифрование копии"
  for file in database.dump uploads.tar; do
    openssl enc -aes-256-cbc -pbkdf2 -salt \
      -in "${TARGET}/${file}" \
      -out "${TARGET}/${file}.enc" \
      -pass env:BACKUP_PASSPHRASE
    rm "${TARGET}/${file}"
  done
fi

# Контрольные суммы: повреждение копии должно обнаруживаться до того,
# как она понадобится, а не в момент аварии
( cd "$TARGET" && shasum -a 256 -- * > SHA256SUMS 2>/dev/null || sha256sum -- * > SHA256SUMS )

SIZE="$(du -sh "$TARGET" | cut -f1)"
log "Готово: ${TARGET} (${SIZE}), схема $(cat "${TARGET}/schema-version.txt")"

# Ротация: старые копии удаляются последними, уже после успешной новой,
# иначе сбой на середине оставил бы и без новой копии, и без старых
if [ "$BACKUP_KEEP_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_KEEP_DAYS}" \
    -exec rm -rf {} + 2>/dev/null || true
  log "Копии старше ${BACKUP_KEEP_DAYS} дней удалены"
fi
