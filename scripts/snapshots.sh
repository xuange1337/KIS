#!/usr/bin/env bash
#
# Снимки версий: «сохранить удачное состояние и поднять его копию сайта».
#
#   npm run snap -- save "метка"   зафиксировать HEAD, собрать и запустить копию
#   npm run snap -- list           снимки, их порты и состояние
#   npm run snap -- up N           снова запустить копию снимка N
#   npm run snap -- down N         остановить копию (данные и тег остаются)
#   npm run snap -- restore N --yes  вернуть ветку к снимку N
#   npm run snap -- drop N         удалить копию и её данные (тег остаётся)
#
# Как это устроено. Снимок — это аннотированный git-тег snap/NNN-метка на
# HEAD плюс копия исходников в .snapshots/NNN и отдельный стенд docker
# compose (проект kis-snap-NNN) со своей базой, томами и портами:
# сайт 8200+NNN, API 3200+NNN, только на 127.0.0.1. Поэтому несколько
# версий живут одновременно, и их можно сравнивать в браузере.
#
# Сохранять можно только закоммиченное состояние: тег должен указывать на
# то, что действительно лежит в репозитории. Старые копии при сохранении
# нового снимка останавливаются так, чтобы работало SNAP_KEEP (по
# умолчанию 3) последних; их тег и данные остаются, `up N` поднимает снова.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
DIR="$ROOT/.snapshots"
COMPOSE="$ROOT/scripts/snapshot.compose.yml"
KEEP="${SNAP_KEEP:-3}"

log() { printf '[snap] %s\n' "$*"; }
die() { printf '[snap] %s\n' "$*" >&2; exit 1; }

pad() { printf '%03d' "$((10#$1))"; }
tag_of() { git tag --list "snap/$(pad "$1")-*" | head -n 1; }
project_of() { printf 'kis-snap-%s' "$(pad "$1")"; }
web_port() { echo $((8200 + 10#$1 % 100)); }
api_port() { echo $((3200 + 10#$1 % 100)); }

dc() {
  local n="$1"; shift
  local id; id="$(pad "$n")"
  SNAP_PROJECT="$(project_of "$n")" SNAP_ID="$id" \
  SNAP_DIR="$DIR/$id" \
  SNAP_WEB_PORT="$(web_port "$n")" SNAP_API_PORT="$(api_port "$n")" \
  docker compose -f "$COMPOSE" --env-file "$DIR/$id/.env.snap" "$@"
}

next_number() {
  local last
  last="$(git tag --list 'snap/[0-9]*' | sed -E 's#snap/([0-9]+)-.*#\1#' | sort -n | tail -n 1)"
  echo $(( 10#${last:-0} + 1 ))
}

is_running() {
  [ -f "$DIR/$(pad "$1")/.env.snap" ] || return 1
  [ -n "$(dc "$1" ps --status running -q 2>/dev/null)" ]
}

wait_ready() {
  local url="http://127.0.0.1:$(web_port "$1")/api/health/ready"
  for _ in $(seq 1 90); do
    curl -fsS "$url" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

make_env() {
  local f="$DIR/$1/.env.snap"
  [ -f "$f" ] && return 0
  {
    echo "SNAP_DB_PASSWORD=$(openssl rand -hex 12)"
    echo "SNAP_JWT_ACCESS=$(openssl rand -hex 32)"
    echo "SNAP_JWT_REFRESH=$(openssl rand -hex 32)"
  } > "$f"
}

enforce_keep() {
  local running=() t n
  for t in $(git tag --list 'snap/[0-9]*' | sort -r); do
    n="$(echo "$t" | sed -E 's#snap/([0-9]+)-.*#\1#')"
    is_running "$n" && running+=("$n")
  done
  local i=0
  for n in "${running[@]:-}"; do
    [ -z "$n" ] && continue
    i=$((i + 1))
    if [ "$i" -gt "$KEEP" ]; then
      log "Копия $(pad "$n") остановлена (держим последние $KEEP)"
      dc "$n" stop >/dev/null
    fi
  done
}

cmd_save() {
  local label="${1:-snapshot}"
  label="$(printf '%s' "$label" | tr -cs 'A-Za-z0-9._а-яА-ЯёЁ-' '-' | sed -E 's/^-+|-+$//g')"
  [ -n "$label" ] || label=snapshot
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    die 'Есть незакоммиченные изменения: сначала git commit, снимок описывает только закоммиченное'
  fi
  local n id tag
  n="$(next_number)"; id="$(pad "$n")"; tag="snap/$id-$label"
  git tag -a "$tag" -m "Снимок $id: $label ($(git rev-parse --short HEAD))"
  log "Тег $tag"
  mkdir -p "$DIR/$id"
  git archive HEAD | tar -x -C "$DIR/$id"
  make_env "$id"
  log "Сборка и запуск копии $id: http://localhost:$(web_port "$n")"
  dc "$n" up -d --build >/dev/null
  wait_ready "$n" || { dc "$n" logs --tail 40 api; die "Копия $id не стала готовой (тег $tag оставлен)"; }
  log 'Наполнение демонстрационными данными'
  dc "$n" exec -T api node dist/database/seeds/seed.js >/dev/null
  enforce_keep
  log "Готово: снимок $id, сайт http://localhost:$(web_port "$n"), API http://localhost:$(api_port "$n")"
}

cmd_list() {
  printf '%-5s %-34s %-9s %-24s %s\n' N ТЕГ СОСТОЯНИЕ САЙТ КОММИТ
  local t n state
  for t in $(git tag --list 'snap/[0-9]*' | sort); do
    n="$(echo "$t" | sed -E 's#snap/([0-9]+)-.*#\1#')"
    if is_running "$n"; then state=работает
    elif [ -d "$DIR/$(pad "$n")" ]; then state=остановлен
    else state=удалён; fi
    printf '%-5s %-34s %-9s %-24s %s\n' "$(pad "$n")" "${t#snap/}" "$state" \
      "http://localhost:$(web_port "$n")" "$(git rev-parse --short "$t^{commit}")"
  done
}

cmd_up() {
  local n="${1:?номер снимка}"; local id; id="$(pad "$n")"
  [ -d "$DIR/$id" ] || die "Копии $id нет: каталога .snapshots/$id не существует"
  dc "$n" up -d --build >/dev/null
  wait_ready "$n" || die "Копия $id не стала готовой"
  enforce_keep
  log "Копия $id: http://localhost:$(web_port "$n")"
}

cmd_down() {
  local n="${1:?номер снимка}"
  dc "$n" stop >/dev/null
  log "Копия $(pad "$n") остановлена"
}

cmd_drop() {
  local n="${1:?номер снимка}"; local id; id="$(pad "$n")"
  [ -d "$DIR/$id" ] || die "Копии $id нет"
  dc "$n" down -v --rmi local >/dev/null 2>&1 || true
  rm -rf "$DIR/$id"
  log "Копия $id удалена вместе с данными; тег $(tag_of "$n") остался"
}

cmd_restore() {
  local n="${1:?номер снимка}"; local confirm="${2:-}"
  local tag; tag="$(tag_of "$n")"
  [ -n "$tag" ] || die "Снимка $(pad "$n") нет"
  [ "$confirm" = "--yes" ] || die "Откат перепишет ветку $(git branch --show-current) на $tag. Повторите с --yes"
  [ -z "$(git status --porcelain --untracked-files=no)" ] || die 'Есть незакоммиченные изменения: закоммитьте или сохраните их'
  local safe="snap/pre-restore-$(date +%Y%m%d-%H%M%S)"
  git tag "$safe"
  git reset --hard "$tag"
  log "Ветка возвращена к $tag. Состояние до отката: тег $safe (git reset --hard $safe вернёт его)"
}

case "${1:-}" in
  save) shift; cmd_save "$@" ;;
  list) cmd_list ;;
  up) shift; cmd_up "$@" ;;
  down) shift; cmd_down "$@" ;;
  drop) shift; cmd_drop "$@" ;;
  restore) shift; cmd_restore "$@" ;;
  *) sed -n '3,19p' "$0"; exit 1 ;;
esac
