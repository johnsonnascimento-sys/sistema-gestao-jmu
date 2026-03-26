#!/bin/bash

set -euo pipefail

REPO_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ -f "$REPO_DIR/.env" ]; then
  set -a
  . "$REPO_DIR/.env"
  set +a
fi

BACKUP_DIR="${JMU_BACKUP_DIR:-/home/johnsontn-app/backups/gestor-web}"
SCHEMA_NAME="${JMU_DATABASE_SCHEMA:-adminlog}"
PG_IMAGE="${JMU_PG_IMAGE:-postgres:17}"
CONTAINER_NAME="${JMU_CONTAINER_NAME:-gestor-jmu-web}"
HEALTH_URL="${JMU_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
READY_URL="${JMU_READY_URL:-http://127.0.0.1:3000/api/ready}"
EVENT_LOG="${JMU_OPS_EVENT_LOG_PATH:-$BACKUP_DIR/operations-events.jsonl}"
STATE_DIR="${JMU_OPS_STATE_DIR:-$BACKUP_DIR/state}"
LOG_DIR="${JMU_OPS_LOG_DIR:-$REPO_DIR/.ops-logs}"
BACKUP_KEEP_LATEST="${JMU_BACKUP_KEEP_LATEST:-15}"

ensure_ops_dirs() {
  mkdir -p "$BACKUP_DIR" "$STATE_DIR" "$LOG_DIR"
}

json_escape() {
  printf '%s' "${1:-}" | tr '\r\n' '  ' | sed 's/\\/\\\\/g; s/"/\\"/g'
}

safe_ref() {
  printf '%s' "${1:-}" | tr -cd '[:alnum:]._:-' | cut -c1-120
}

log_event() {
  local kind="$1"
  local status="$2"
  local source="$3"
  local message="$4"
  local reference="${5:-}"

  ensure_ops_dirs

  printf '{"id":"%s","kind":"%s","status":"%s","source":"%s","message":"%s","reference":"%s","occurredAt":"%s"}\n' \
    "$(date -u +%Y%m%dT%H%M%SZ)-$$" \
    "$(json_escape "$kind")" \
    "$(json_escape "$status")" \
    "$(json_escape "$source")" \
    "$(json_escape "$message")" \
    "$(json_escape "$(safe_ref "$reference")")" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$EVENT_LOG"
}

require_env_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Variavel obrigatoria ausente: $name" >&2
    return 1
  fi
}
