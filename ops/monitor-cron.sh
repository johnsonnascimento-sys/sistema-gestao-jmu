#!/bin/bash

set -euo pipefail

. "$(dirname "$0")/common.sh"

ensure_ops_dirs

state_file="$STATE_DIR/monitor.status"
previous_state="unknown"

if [ -f "$state_file" ]; then
  previous_state="$(cat "$state_file" 2>/dev/null || echo unknown)"
fi

monitor_failure() {
  printf 'failure\n' > "$state_file"

  if [ "$previous_state" != "failure" ]; then
    log_event "monitor" "failure" "monitor-cron" "Healthcheck, readiness ou smoke falhou." "$CONTAINER_NAME"
  fi

  exit 1
}

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  monitor_failure
fi

if ! curl -fsS "$HEALTH_URL" >/dev/null; then
  monitor_failure
fi

if ! curl -fsS "$READY_URL" >/dev/null; then
  monitor_failure
fi

if ! docker exec \
  -e APP_BASE_URL="http://127.0.0.1:3000" \
  -e SMOKE_TEST_REQUIRE_AUTH="${SMOKE_TEST_REQUIRE_AUTH:-}" \
  -e SMOKE_TEST_REQUIRE_ADMIN="${SMOKE_TEST_REQUIRE_ADMIN:-}" \
  -e SMOKE_TEST_EMAIL="${SMOKE_TEST_EMAIL:-}" \
  -e SMOKE_TEST_PASSWORD="${SMOKE_TEST_PASSWORD:-}" \
  -e SMOKE_TEST_ADMIN_EMAIL="${SMOKE_TEST_ADMIN_EMAIL:-}" \
  -e SMOKE_TEST_ADMIN_PASSWORD="${SMOKE_TEST_ADMIN_PASSWORD:-}" \
  "$CONTAINER_NAME" \
  node dist/server/scripts/smoke-test.js >/dev/null 2>&1; then
  monitor_failure
fi

printf 'success\n' > "$state_file"

if [ "$previous_state" != "success" ]; then
  log_event "monitor" "success" "monitor-cron" "Monitoracao recuperada ou validada." "$CONTAINER_NAME"
fi
