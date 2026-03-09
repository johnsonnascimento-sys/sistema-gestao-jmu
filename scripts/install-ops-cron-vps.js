const { runRemoteBash } = require("./lib/ssh-runner");

function bashSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

async function run() {
  const remoteDir = process.env.JMU_REMOTE_APP_DIR || "/home/johnsontn-app/apps/gestor-web";
  const logDir = process.env.JMU_REMOTE_LOG_DIR || `${remoteDir}/.ops-logs`;
  const backupCron = process.env.JMU_BACKUP_CRON || "15 3 * * *";
  const monitorCron = process.env.JMU_MONITOR_CRON || "*/5 * * * *";
  const restoreDrillCron = process.env.JMU_RESTORE_DRILL_CRON || "30 4 * * 0";
  const bootstrapAuditCron = process.env.JMU_BOOTSTRAP_AUDIT_CRON || "0 5 * * 1";

  await runRemoteBash([
    "set -euo pipefail",
    `REMOTE_DIR=${bashSingleQuote(remoteDir)}`,
    `LOG_DIR=${bashSingleQuote(logDir)}`,
    `BACKUP_CRON=${bashSingleQuote(backupCron)}`,
    `MONITOR_CRON=${bashSingleQuote(monitorCron)}`,
    `RESTORE_DRILL_CRON=${bashSingleQuote(restoreDrillCron)}`,
    `BOOTSTRAP_AUDIT_CRON=${bashSingleQuote(bootstrapAuditCron)}`,
    'mkdir -p "$LOG_DIR"',
    'CRON_FILE="$(mktemp)"',
    '(crontab -l 2>/dev/null || true) | grep -v "JMU_GESTOR_" > "$CRON_FILE"',
    'echo "$BACKUP_CRON cd $REMOTE_DIR && /bin/bash ops/backup-cron.sh >> $LOG_DIR/backup-cron.log 2>&1 # JMU_GESTOR_BACKUP" >> "$CRON_FILE"',
    'echo "$MONITOR_CRON cd $REMOTE_DIR && /bin/bash ops/monitor-cron.sh >> $LOG_DIR/monitor-cron.log 2>&1 # JMU_GESTOR_MONITOR" >> "$CRON_FILE"',
    'echo "$RESTORE_DRILL_CRON cd $REMOTE_DIR && /bin/bash ops/restore-drill.sh >> $LOG_DIR/restore-drill.log 2>&1 # JMU_GESTOR_RESTORE_DRILL" >> "$CRON_FILE"',
    'echo "$BOOTSTRAP_AUDIT_CRON cd $REMOTE_DIR && /bin/bash ops/bootstrap-audit.sh >> $LOG_DIR/bootstrap-audit.log 2>&1 # JMU_GESTOR_BOOTSTRAP_AUDIT" >> "$CRON_FILE"',
    'crontab "$CRON_FILE"',
    'rm -f "$CRON_FILE"',
    'echo "installed_cron_jobs="',
    'crontab -l | grep "JMU_GESTOR_"',
  ].join("\n"));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
