# Scripts Operacionais do Gestor Web

Este directorio contem apenas scripts operacionais do Gestor Web para a VPS.

## Regras
- Segredos ficam em `.env` local ou em variaveis de ambiente da VPS. Nunca hardcode.
- Os scripts daqui fazem parte da operacao atual do sistema.
- Backup, restore, rollback, deploy e status devem seguir o runbook em `docs/GESTOR_WEB_RUNBOOK.md`.

## Scripts disponiveis
- `backup-gestor-vps.js`: gera dump remoto do schema operacional.
- `bootstrap-audit-vps.js`: audita bootstrap, `.env`, cron e artefactos operacionais.
- `deploy-gestor-vps.js`: faz deploy remoto com validacao e rollback automatico.
- `drill-restore-vps.js`: testa restore em ambiente temporario.
- `install-ops-cron-vps.js`: instala jobs remotos de backup, monitoracao e auditoria.
- `restore-gestor-vps.js`: restaura backup remoto com validacoes de seguranca.
- `rollback-gestor-vps.js`: executa rollback remoto para uma release anterior.
- `status-gestor-vps.js`: mostra o estado do ambiente remoto.
