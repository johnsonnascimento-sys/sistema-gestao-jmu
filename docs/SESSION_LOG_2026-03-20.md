# SESSION LOG - 2026-03-20

## O que
- Formalizada a convencao de agentes especialistas do projeto no arquivo `AGENT_RULES`.
- Definidos os nomes e papeis operacionais dos agentes `Atlas`, `Laplace`, `Turing`, `Ada` e `SRE-1`.
- Definida a politica de escolha de modelos por subagente conforme complexidade e risco tecnico.
- Definida a politica de `reasoning_effort` por subagente conforme complexidade, impacto e ambiguidade.
- Criado o arquivo versionavel `agents.toml` para persistir a configuracao portavel dos agentes entre computadores.
- Criado o arquivo `START_HERE_AGENTS.md` para orientar a retomada do padrao de agentes em novas maquinas e sessoes.
- Refinada a politica operacional para deixar explicito que subagentes devem ser usados por padrao em tarefas de dominio especializado.
- Formalizada a excecao operacional de que `git add`, `git commit`, `git push` e `deploy` permanecem no agente principal, salvo decisao explicita em contrario.
- Formalizada a regra de transparencia para informar nome, funcao e modelo sempre que um agente ou subagente for utilizado.

## Identificadores
- Arquivo atualizado: `AGENT_RULES`
- Data do registro: `2026-03-20`

## Validacao
- A regra passou a documentar explicitamente o papel do coordenador e os dominios de responsabilidade de cada subagente.
- Tambem foi registrado o protocolo de delegacao para tarefas de banco, backend, frontend e operacoes.
- Tambem foi registrada a regra de escalonamento entre `gpt-5.4-mini` e `gpt-5.4`.
- Tambem foi registrada a regra de escalonamento entre `medium`, `high` e `xhigh`.
- Tambem foi estabelecido `agents.toml` como fonte de verdade portavel para instanciacao de agentes.
- Tambem foi estabelecido `START_HERE_AGENTS.md` como ponto de entrada rapido para reconstituir a convencao operacional.
- Tambem ficou documentado que `Ada`, `Turing`, `Laplace` e `SRE-1` devem ser priorizados na execucao especializada.
- Tambem ficou documentado que o agente principal continua responsavel pela integracao final e pelas etapas sensiveis de versionamento e deploy.
- Tambem ficou documentado que a sessao deve anunciar explicitamente ao usuario qual agente foi usado e com qual modelo.

## Seguranca
- Nenhum segredo foi registrado.
- Nenhuma credencial ou valor de ambiente foi copiado para a documentacao.
