#!/bin/bash

set -euo pipefail

. "$(dirname "$0")/common.sh"

ensure_ops_dirs

issues=""

if [ ! -f "$REPO_DIR/.env" ]; then
  issues="${issues} .env-ausente"
fi

for required_var in DATABASE_URL SESSION_SECRET CLIENT_ORIGIN APP_BASE_URL; do
  if [ -z "${!required_var:-}" ]; then
    issues="${issues} ${required_var}-ausente"
  fi
done

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  issues="${issues} container-ausente"
fi

mount_source="$(docker inspect "$CONTAINER_NAME" --format '{{range .Mounts}}{{if eq .Destination "/backup/ops"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"
if [ -n "$mount_source" ] && [ "$mount_source" != "$BACKUP_DIR" ]; then
  issues="${issues} mount-backup-divergente"
fi

if [ ! -d "$BACKUP_DIR" ]; then
  issues="${issues} diretorio-backup-ausente"
fi

latest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "gestor-${SCHEMA_NAME}-*.sql.gz" | sort -r | head -n 1 || true)"
if [ -z "$latest_backup" ]; then
  issues="${issues} backup-ausente"
fi

current_crontab="$(crontab -l 2>/dev/null || true)"
for marker in JMU_GESTOR_BACKUP JMU_GESTOR_MONITOR JMU_GESTOR_RESTORE_DRILL JMU_GESTOR_BOOTSTRAP_AUDIT; do
  if ! printf '%s\n' "$current_crontab" | grep -q "$marker"; then
    issues="${issues} ${marker}-ausente"
  fi
done

if [ -n "$issues" ]; then
  log_event "bootstrap_audit" "failure" "bootstrap-audit" "Auditoria de bootstrap encontrou pendencias." "$issues"
  echo "bootstrap_audit_issues=$issues" >&2
  exit 1
fi

log_event "bootstrap_audit" "success" "bootstrap-audit" "Auditoria de bootstrap validada." "$(basename "${latest_backup:-ok}")"
echo "bootstrap_audit=ok"
