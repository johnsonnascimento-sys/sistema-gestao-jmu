# START HERE - AGENTES DO PROJETO

Use este roteiro ao iniciar uma sessao em qualquer computador.

## Ordem de leitura

1. `AI_BOOTLOADER.md`
2. `AGENT_RULES`
3. `agents.toml`

## Operacao

- `Atlas` e o ponto de entrada. `Laplace`, `Turing`, `Ada` e `SRE-1` sao especialistas acionados apenas quando agregarem ganho claro.
- `agents.toml` define os modelos, o reasoning effort e os criterios de delegacao; nao duplicar sua matriz neste arquivo.
- A escada de modelos e Luna -> Terra -> Sol; Astra e excepcional, nunca padrao, e requer escopo fechado, criterio de sucesso e justificativa antes do uso.
- Tarefas pequenas, localizadas e de baixo risco podem ser feitas pelo agente principal.
- O agente principal conserva a integracao final e, por padrao, `git add`, `git commit`, `git push` e deploy.
- Informar agentes e modelos antes do uso; ao final, relatar os efetivamente usados, resultado e consumo estimado de tokens ou `estimado_indisponivel`.

## Persistencia

Os agentes nao persistem como processos entre sessoes. A configuracao portavel fica em `agents.toml`; `AGENT_RULES` descreve os limites e responsabilidades do projeto.
