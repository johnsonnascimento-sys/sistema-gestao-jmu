#!/bin/bash

set -euo pipefail

. "$(dirname "$0")/common.sh"

ensure_ops_dirs

backup_file="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" | sort -r | head -n 1)"

if [ -z "$backup_file" ]; then
  log_event "restore_drill" "failure" "restore-drill" "Nao foi encontrado backup para o drill de restore." ""
  echo "Nenhum backup encontrado em $BACKUP_DIR" >&2
  exit 1
fi

drill_container="gestor-restore-drill-$(date -u +%Y%m%d%H%M%S)-$$"

cleanup_drill() {
  local exit_code=$?
  docker rm -f "$drill_container" >/dev/null 2>&1 || true

  if [ "$exit_code" -ne 0 ]; then
    log_event "restore_drill" "failure" "restore-drill" "Drill de restore falhou." "$(basename "$backup_file")"
  fi

  exit "$exit_code"
}

trap cleanup_drill EXIT

docker run -d --name "$drill_container" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gestor_drill "$PG_IMAGE" >/dev/null

for _attempt in $(seq 1 30); do
  if docker exec "$drill_container" pg_isready -U postgres -d gestor_drill >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker exec "$drill_container" pg_isready -U postgres -d gestor_drill >/dev/null 2>&1
gunzip -c "$backup_file" | docker exec -i "$drill_container" psql -U postgres -d gestor_drill -v ON_ERROR_STOP=1 >/dev/null

required_tables="$(docker exec "$drill_container" psql -U postgres -d gestor_drill -Atqc "select count(*) from information_schema.tables where table_schema='${SCHEMA_NAME}' and table_name in ('schema_migration','app_user','pre_demanda','pre_to_sei_link','pre_demanda_status_audit')")"
if [ "${required_tables:-0}" -lt 5 ]; then
  echo "Restore drill sem todas as tabelas esperadas." >&2
  exit 1
fi

log_event "restore_drill" "success" "restore-drill" "Drill de restore validado." "$(basename "$backup_file")"
echo "restore_drill_file=$backup_file"
trap - EXIT
docker rm -f "$drill_container" >/dev/null 2>&1 || true
