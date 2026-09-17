# AGENTS

Este repositorio usa a politica operacional definida em `agents.toml`.
Leia tambem `AI_BOOTLOADER.md`, `AGENT_RULES` e `START_HERE_AGENTS.md` na ordem indicada por este ultimo arquivo.

Regras essenciais:
- `agents.toml` e a fonte de verdade para selecao de modelo, reasoning e delegacao.
- Antes de usar agente ou subagente, informar nome, papel, modelo e, quando relevante, o reasoning effort.
- Ao finalizar, informar os agentes efetivamente usados, o resultado e o consumo estimado de tokens; se indisponivel, usar `estimado_indisponivel`.
- A escada de modelos e `gpt-5.6-luna` -> `gpt-5.6-terra` -> `gpt-5.6-sol` -> `gpt-6-astra` excepcional. Astra nunca e padrao e exige justificativa registrada antes do uso.
