# Sessao 2026-09-17 — Iniciar Processo Relacionado

## Alteracao

- Botao no detalhe de processos/demandas abre o cadastro em branco com `origemPreId` na URL. O formulario identifica a origem, permite cancelar e abre o novo registro depois de salvar.
- `POST /api/pre-demandas` recebe `origem_pre_id` opcional e exige criacao e gerenciamento de vinculos para esse fluxo.
- O repositorio PostgreSQL grava processo, `demanda_vinculos` e auditoria dos dois registros na mesma transacao. Reutiliza schema e restricoes existentes, sem migration.
- Duplicados sem o vinculo solicitado retornam conflito; repeticoes ja vinculadas retornam o resultado idempotente sem repetir auditoria. Origem encerrada nao e reaberta.
- Eventos de relacionamento notificam ambos os processos. Consulta e remocao continuam usando a area Relacionamentos.

## Validacao em PostgreSQL real

Instancia PostgreSQL 17.7 temporaria e isolada, restrita ao loopback, com as 32 migrations aplicadas. Nenhuma conexao ao banco operacional ou ao servico PostgreSQL preexistente foi usada.

Nove cenarios aprovados usando o repositorio real:

1. Criacao de processo independente com vinculo consultavel nos dois lados.
2. Reenvio idempotente, sem duplicacao de vinculos ou historico.
3. Conflito para cadastro existente sem vinculo e rejeicao de autorrelacionamento.
4. Origem inexistente rejeitada sem criar registro orfao.
5. Origem SEI encerrada permanece encerrada; novo processo nao herda numero nem status.
6. Origem judicial encerrada permanece encerrada; novo processo nao herda numero nem status.
7. Quatro envios concorrentes criam um unico registro, um vinculo e uma entrada de auditoria por lado.
8. Trigger de teste provoca falha ao inserir o vinculo; transacao desfaz novo processo e auditoria.
9. Remocao pelo destino preserva ambos os processos, remove o relacionamento dos dois lados e registra os dois historicos.

## Seguranca e entrega

- Scripts de status, deploy e rollback aceitam `JMU_SSH_HOST_FINGERPRINT` para validar a chave publica da VPS durante a negociacao SSH, antes da autenticacao. Nenhuma credencial e persistida no repositorio.
- Suite final: `npm test` com 21 arquivos e 88 testes aprovados; `npm run build` com frontend e backend aprovados.
- Checagem de tipos do cliente: 32 erros no estado atual e os mesmos 32 erros em uma copia isolada de `HEAD`, sem erro introduzido pela mudanca.
- Nenhuma senha, chave ou dado de producao foi usado nos testes.
- Sem operacoes no SEI/e-Proc externo e sem alteracao de infraestrutura produtiva.
- Arquitetura, handover e visao funcional atualizados.
- Responsaveis: Atlas (coordenacao e integracao, modelo da sessao), Ada e Turing (GPT-5.6 Terra, frontend e backend), SRE-1 (GPT-5.6 Luna, verificacoes e banco temporario).
