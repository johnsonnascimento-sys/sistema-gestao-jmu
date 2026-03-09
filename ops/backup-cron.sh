#!/bin/bash

set -euo pipefail

. "$(dirname "$0")/common.sh"

ensure_ops_dirs
require_env_var DATABASE_URL

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
label="$(safe_ref "${JMU_BACKUP_LABEL:-cron}")"
label_suffix=""

if [ -n "$label" ]; then
  label_suffix="-$label"
fi

backup_basename="gestor-${SCHEMA_NAME}-${timestamp}${label_suffix}.sql.gz"
backup_file="$BACKUP_DIR/$backup_basename"
tmp_sql_file="$BACKUP_DIR/gestor-${SCHEMA_NAME}-${timestamp}${label_suffix}.sql.part"
tmp_backup_file="$tmp_sql_file.gz"

cleanup_failure() {
  local exit_code=$?

  if [ "$exit_code" -ne 0 ]; then
    rm -f "$tmp_sql_file" "$tmp_backup_file"
    log_event "backup" "failure" "backup-cron" "Backup falhou." "$backup_basename"
  fi

  exit "$exit_code"
}

trap cleanup_failure EXIT

rm -f "$tmp_sql_file" "$tmp_backup_file"

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SCHEMA_NAME="$SCHEMA_NAME" \
  -e TMP_SQL_FILE_BASENAME="$(basename "$tmp_sql_file")" \
  -v "$BACKUP_DIR:/backup" \
  "$PG_IMAGE" \
  /bin/sh -lc 'pg_dump --no-owner --no-privileges --schema "$SCHEMA_NAME" -f "/backup/$TMP_SQL_FILE_BASENAME" "$DATABASE_URL"'

if [ ! -s "$tmp_sql_file" ]; then
  echo "Backup SQL gerado com tamanho zero." >&2
  exit 1
fi

gzip -9 "$tmp_sql_file"
gzip -t "$tmp_backup_file"

uncompressed_size="$(gzip -l "$tmp_backup_file" | awk 'NR==2 {print $2}')"
if [ -z "$uncompressed_size" ] || [ "$uncompressed_size" -le 0 ]; then
  echo "Backup comprimido sem conteudo util." >&2
  exit 1
fi

mv "$tmp_backup_file" "$backup_file"

find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" | while read -r invalid_file; do
  invalid_size="$(gzip -l "$invalid_file" | awk 'NR==2 {print $2}')"
  if [ -z "$invalid_size" ] || [ "$invalid_size" -le 0 ]; then
    rm -f "$invalid_file"
    echo "removed_invalid_backup=$invalid_file"
  fi
done

if [ "${BACKUP_KEEP_LATEST}" -gt 0 ] 2>/dev/null; then
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" | sort -r | tail -n +"$(("${BACKUP_KEEP_LATEST}" + 1))" | while read -r old_file; do
    rm -f "$old_file"
    echo "pruned_backup=$old_file"
  done
fi

echo "backup_file=$backup_file"
echo "backup_size=$(du -h "$backup_file" | cut -f1)"
echo "backup_sha256=$(sha256sum "$backup_file" | cut -d' ' -f1)"
log_event "backup" "success" "backup-cron" "Backup concluido." "$backup_basename"
trap - EXIT
