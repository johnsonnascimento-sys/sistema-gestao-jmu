# START HERE - AGENTES DO PROJETO

Este arquivo existe para padronizar o comportamento do Codex e de agentes especialistas em qualquer computador.

## Objetivo
- Garantir que a mesma convencao de agentes seja aplicada em multiplas maquinas.
- Reduzir ambiguidade ao iniciar novas sessoes.
- Definir a ordem minima de leitura antes de qualquer delegacao.

## Ordem Obrigatoria de Leitura
1. `AI_BOOTLOADER.md`
2. `AGENT_RULES`
3. `agents.toml`

## Regra Operacional
- O agente de entrada padrao e `Atlas`.
- `Atlas` atua como coordenador principal.
- Os subagentes sao instanciados sob demanda, conforme a tarefa:
  - `Laplace`: banco de dados e migrations
  - `Turing`: backend e integracoes
  - `Ada`: frontend e UI/UX
  - `SRE-1`: QA, DevOps e operacoes

## Persistencia
- Os subagentes nao persistem entre sessoes como processos ativos.
- O que persiste no repositorio e a configuracao portavel em `agents.toml` e as regras em `AGENT_RULES`.
- Em um computador novo, a sessao deve recriar os agentes seguindo esses arquivos.

## Politica de Modelo
- Use `gpt-5.4-mini` como padrao para tarefas especializadas, delimitadas e de menor risco.
- Use `gpt-5.4` para tarefas de maior impacto, ambiguidade, risco tecnico ou coordenacao entre dominios.

## Politica de Reasoning
- Use `medium` como padrao.
- Use `high` para tarefas com integracao moderada ou analise comparativa.
- Use `xhigh` para arquitetura, producao, reconciliacao historica, investigacao profunda ou alto risco tecnico.

## Quando Atualizar Este Arquivo
- Sempre que houver mudanca na convencao de agentes.
- Sempre que mudar a ordem de leitura ou a politica de modelo/reasoning.
- Sempre que um novo agente especialista for adicionado ou removido.
