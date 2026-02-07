# Sistema de Gestão JMU - Arquitetura Técnica

## 1. Componentes e Responsabilidades

### A) VPS (Hostinger)
- Hospeda tudo.
- Perímetro de segurança: Firewall, Nginx, Docker.

### B) Docker
- `n8n`: Aplicação de automação e orquestração.
- `n8n_postgres`: Banco de dados principal (Single Source of Truth).
- *(Futuro)* `redis`: Fila/cache.

### C) Nginx + CloudPanel
- Termina HTTPS (SSL).
- Reverse Proxy para o n8n.
- Controle de acesso por rota (Proteção de Webhooks).

### D) PostgreSQL (Schema `adminlog` ou `public`)
- Fonte da verdade.
- Guarda eventos, demandas pré-SEI, vínculos, audiências.

### E) Clientes (Origem)
- Webhooks (HTTP POST).
- Importação em massa (CSV/Excel).
- *(Futuro)* Front-end mobile/desktop.

---

## 2. Camadas do Sistema

### Camada 1 — Entrada (Ingestão)
Transformar “fato” em dados estruturados via Webhooks ou Importação.

### Camada 2 — Normalização e Validação
Garantir consistência (Padronizar nomes, validar formato de número SEI, checar datas).

### Camada 3 — Persistência (Postgres)
Insert/Update nas tabelas. Auditoria e histórico imutável.

### Camada 4 — Contexto e Associação
Conectar itens desconexos (Ex: Associação Pré-SEI → SEI; Vínculos entre processos).

### Camada 5 — Produção Documental + IA
Gerar minutas fundamentadas. Input estruturado → Output estruturado (TXT/JSON).  
*Nota: A IA não decide, apenas prepara.*

### Camada 6 — Segurança
Nginx limitando acesso + API Key no Header. Sem acesso automático a sistemas oficiais.

---

## 3. Modelo de Dados (Schema Recomendado)

### 1) Tabela `sei_event` (Já existente como `eventos_judiciais`)
- `id` (PK)
- `sei_numero` (text, indexado)
- `tipo_evento` (text)
- `fonte` (text)
- `evento_em` (timestamptz)
- `observacoes` (text)
- `created_at` (timestamptz)

### 2) Tabela `pre_demanda` (Para demandas informais)
- `id` (PK)
- `pre_id` (text, único, ex: PRE-2026-001)
- `solicitante` (text)
- `assunto` (text)
- `status` (text: aberta, aguardando_sei, associada)
- `created_at`, `updated_at`

### 3) Tabela `pre_to_sei_link` (A Ponte)
- `id` (PK)
- `pre_id` (FK)
- `sei_numero` (Indexado)
- `linked_at` (timestamptz)  
*Regra: Uma pré-demanda vira um SEI.*

---

## 4. Endpoints (API Interna N8N)

### Existentes:
- ✅ `POST /webhook/sei/evento` (Registro de evento com número)

### Planejados:
- `POST /webhook/presei/criar` (Nova demanda informal)
- `POST /webhook/presei/associar-sei` (Vincular demanda ao processo)
- `POST /webhook/pendencias/listar` (Para o Front-end)

---

## 5. Fluxo Mental "Mundo Real"

1. **Antes do SEI:** Chega pedido informal -> Registra na tabela `pre_demanda` (Gera ID Provisório).
2. **Nascimento:** Cria processo no SEI -> Associa ID Provisório ao `sei_numero` na tabela `pre_to_sei_link`.
3. **Andamento:** Registra eventos na `sei_event` (Ofícios, Despachos).
4. **Documentos:** Solicita minuta via IA -> Sistema gera texto -> Humano revisa e usa no SEI.
