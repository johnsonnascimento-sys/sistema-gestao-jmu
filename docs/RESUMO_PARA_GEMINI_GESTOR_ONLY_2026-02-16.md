# Resumo para Gemini - Gestor JMU ONLY (sem RAG)

Atualizado em: 2026-02-16

## Instrucao principal
Voce deve atuar APENAS no modulo Gestor JMU (fluxo administrativo pre-SEI/SEI).

Nao implementar, alterar, planejar ou depender de:
- RAG
- indexacao de normas
- embeddings
- Gemini para busca semantica
- pipelines de PDF/HTML juridico
- tabelas `normas_index` e `ai_generation_log`

Tudo isso fica CONGELADO temporariamente.

## Objetivo do modulo Gestor JMU
Controlar demandas informais (antes do SEI), permitir associacao ao numero SEI quando nascer o processo e manter auditoria das reassociacoes.

Fluxo alvo:
1. Entrada de demanda informal.
2. Registro em `adminlog.pre_demanda` com `pre_id` unico.
3. Quando houver SEI, vinculacao em `adminlog.pre_to_sei_link`.
4. Consulta de pendencias abertas/aguardando SEI.
5. Auditoria de alteracoes de vinculo PRE -> SEI em `adminlog.pre_to_sei_link_audit`.

## Fonte da verdade (Gestor)
- `AI_BOOTLOADER.md` (regras gerais e idempotencia)
- `ARCHITECTURE.md` (secoes 1 a 5)
- `sql/adminlog_provisionamento.sql` (schema real implementado)

## Estado atual real (somente Gestor)
Concluido:
- Schema `adminlog` provisionado.
- Funcoes e triggers para controle de `updated_at`.
- Tabelas:
  - `adminlog.pre_id_counter`
  - `adminlog.pre_demanda`
  - `adminlog.pre_to_sei_link`
  - `adminlog.pre_to_sei_link_audit`
- Regra de idempotencia ja no banco por indice unico:
  - `solicitante_norm + assunto_norm + data_referencia`

Pendente:
- Workflows n8n do Gestor (CRUD operacional do pre-SEI/SEI).
- Endpoints do Gestor publicados e testados.
- Pagina Appsmith do Gestor (sem depender da tela de busca RAG).

## Contratos de dados (banco)

### 1) `adminlog.pre_demanda`
Campos chave:
- `pre_id` (unico, formato `PRE-ANO-XXX`)
- `solicitante`
- `assunto`
- `data_referencia` (date)
- `status` em:
  - `aberta`
  - `aguardando_sei`
  - `associada`
  - `encerrada`
- `descricao`, `fonte`, `observacoes`
- `created_at`, `updated_at`

Regras:
- Idempotencia por `solicitante_norm`, `assunto_norm`, `data_referencia`.
- Trigger atualiza `updated_at` em updates.

### 2) `adminlog.pre_to_sei_link`
Campos chave:
- `pre_id` (unico, FK para `pre_demanda.pre_id`)
- `sei_numero`
- `linked_at`, `updated_at`, `observacoes`

### 3) `adminlog.pre_to_sei_link_audit`
Campos chave:
- `pre_id`
- `sei_numero_anterior`
- `sei_numero_novo`
- `motivo`
- `registrado_em`

## Endpoints alvo do Gestor (n8n)
Planejados na arquitetura:
- `POST /webhook/presei/criar`
- `POST /webhook/presei/associar-sei`
- `POST /webhook/pendencias/listar`

### Payload sugerido - criar pre-demanda
```json
{
  "solicitante": "Nome do solicitante",
  "assunto": "Assunto da demanda",
  "data_referencia": "2026-02-16",
  "descricao": "Detalhes opcionais",
  "fonte": "whatsapp",
  "observacoes": "texto opcional"
}
```

Resposta esperada:
```json
{
  "ok": true,
  "pre_id": "PRE-2026-001",
  "status": "aberta",
  "idempotente": false
}
```

### Payload sugerido - associar PRE ao SEI
```json
{
  "pre_id": "PRE-2026-001",
  "sei_numero": "0000000-00.2026.4.00.0000",
  "motivo": "Processo criado no SEI",
  "observacoes": "texto opcional"
}
```

Resposta esperada:
```json
{
  "ok": true,
  "pre_id": "PRE-2026-001",
  "sei_numero": "0000000-00.2026.4.00.0000",
  "auditado": true
}
```

### Payload sugerido - listar pendencias
```json
{
  "status": ["aberta", "aguardando_sei"],
  "limit": 50
}
```

Resposta esperada:
```json
{
  "ok": true,
  "total": 12,
  "items": []
}
```

## Regras operacionais obrigatorias
- Datas em ISO (`YYYY-MM-DD` ou timestamp ISO).
- Nunca perder historico de reassociacao PRE -> SEI.
- Nao criar duplicata quando bater regra de idempotencia.
- Sempre retornar erro claro quando faltar campo obrigatorio.
- Nao expor segredos em logs ou payload de resposta.

## Backlog imediato (ordem de execucao)
1. Implementar workflow `presei/criar` no n8n.
2. Implementar workflow `presei/associar-sei` no n8n com escrita em auditoria.
3. Implementar workflow `pendencias/listar`.
4. Criar pagina Appsmith do Gestor:
   - cadastro de demanda
   - lista de pendencias
   - acao de associar ao SEI
5. Rodar QA E2E do Gestor (sem nenhuma dependencia de RAG).

## Prompt curto para retomar no Gemini
Use este bloco:

```text
Continuar APENAS no modulo Gestor JMU (pre-SEI/SEI), sem RAG e sem indexacao.
Fonte da verdade: AI_BOOTLOADER.md, ARCHITECTURE.md (secoes 1-5), sql/adminlog_provisionamento.sql e docs/RESUMO_PARA_GEMINI_GESTOR_ONLY_2026-02-16.md.
Implemente primeiro os endpoints n8n:
1) POST /webhook/presei/criar
2) POST /webhook/presei/associar-sei
3) POST /webhook/pendencias/listar
Com validacao, idempotencia e auditoria.
Depois preparar a tela Appsmith do Gestor.
```
