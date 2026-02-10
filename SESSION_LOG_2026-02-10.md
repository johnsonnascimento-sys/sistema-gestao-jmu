# Log de Sessao - 10/02/2026

## Objetivos
1. Resolver problemas de conectividade entre Appsmith e Supabase (IPv6 vs IPv4).
2. Configurar datasources no Appsmith.
3. Criar a tela "Nova Demanda" (formulario de insercao).

---

## 1) Infraestrutura e Conectividade (Supabase)
Problema: o Appsmith (na VPS) falhava ao conectar diretamente no host principal do Supabase (`db.<ref>.supabase.co`), possivelmente por rota/incompatibilidade com IPv6 no ambiente.

Solucao: usar o Supabase Session Pooler (IPv4).
- Host (pooler): `aws-0-us-west-2.pooler.supabase.com`
- Porta: `5432` (Session)
- Usuario (formato do pooler): `postgres.<ref>`
- SSL mode: `Require`
- Resultado: conexao estavel e schemas `adminlog` e `public` visiveis no Appsmith.

---

## 2) Appsmith (Fase 3)

### Datasources
- Postgres: `Supabase JMU` (pooler session 5432, SSL Require).
- REST: `N8N Webhooks` com base `https://n8n.johnsontn.com.br/webhook` e header global `x-api-key`.

### Tela: "Nova Demanda"
Foi criado um formulario para registrar demandas informais.

#### A) Query SQL (Insercao)
- Nome: `insert_demanda`
- Datasource: `Supabase JMU`
- Alvo: `adminlog.pre_demanda`

Correcao tecnica: foi necessario ajustar o binding de data do DatePicker para usar `moment()` e garantir formato `YYYY-MM-DD`.

Exemplo de trecho (geracao de `pre_id`):
```sql
adminlog.fn_generate_pre_id({{ moment(DatePicker1.selectedDate).format('YYYY-MM-DD') }}::date)
```

#### B) Widgets
- `InputSolicitante` (Text)
- `InputAssunto` (Text)
- `DatePicker1` (Default: `{{ moment() }}`)
- `InputDescricao` (TextArea/Rich Text)
- `InputObservacoes` (TextArea)
- `BtnEnviar` (Button: "Registrar Demanda")

#### C) Logica (onClick do botao)
1. Executa `insert_demanda`.
2. Sucesso: alerta + limpa campos.
3. Erro: alerta com mensagem de erro.

---

## 3) Seguranca
- Criado `MEUS_SEGREDOS.txt` (local) para centralizar credenciais.
- Confirmado `.gitignore` para impedir commit desse arquivo.

---

## Proximos Passos
1. Dashboard: tabela listando demandas (`SELECT * FROM adminlog.pre_demanda ORDER BY criado_em DESC`).
2. Se necessario: integrar botao "Salvar" com webhook do n8n (alem do insert direto no Postgres), para acionar fluxos de automacao.

