# Manual do Usuario - JMU_Gestao_Inteligente

Tela: `Busca_Normas`

Link:
`https://app.johnsontn.com.br/app/jmu-gestao-inteligente/busca-normas-6992325c8a3a0012fc7c5ed7`

## O que faz
Busca normas indexadas no Supabase.

## Como funciona
- Busca lexical: funciona sem API key.
- Busca semantica: usa Gemini API key valida.
- Com key, o botao `Buscar` roda as duas buscas e mescla os resultados.
- O cache local evita chamadas repetidas ao Gemini para o mesmo termo.

## Uso rapido
1. Digite o termo.
2. Opcional: salve a Gemini API key.
3. Clique em `Buscar`.

## Campos da tabela
- `tipo`: por que o resultado apareceu
- `norma_id`: identificador da norma
- `artigo`: referencia detectada
- `conteudo_texto`: trecho retornado
- `similarity`: score de similaridade
- `id`: id do chunk
- `chunk_index` / `source_url`: auditoria tecnica

## Limpeza e quota
- `Limpar Busca` apaga consulta e resultados antigos.
- A quota exibida e apenas estimativa local.

## Troubleshooting
- Tabela vazia: tente outro termo ou remova a API key para testar o fallback lexical.
- Erro na busca: use a aba `Queries` no editor e veja `Response`, `Logs` e `Errors`.

## Seguranca
- Nao commitar keys/senhas.
- Se a API key vazou em chat ou log, rotacione.

## Ingestao Web
Tela: `Upload_Normas` -> aba `Legislacao Federal (Web)`.
- Cole a URL do Planalto.
- Opcional: informe `norma_id`.
- Clique em `Ingerir URL`.
- Action: `IngerirNormaWeb`
- Datasource: `N8N Webhooks`
- Endpoint: `/webhook/index-norma-web-v3`
