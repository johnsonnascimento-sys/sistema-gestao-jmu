# Manual do Usuario - JMU_Gestao_Inteligente

Tela: `Busca_Normas`

Link (view):
`https://app.johnsontn.com.br/app/jmu-gestao-inteligente/busca-normas-6992325c8a3a0012fc7c5ed7`

## 1) Para que serve esta tela?
Esta tela serve para **pesquisar normas** que ja foram indexadas no Supabase (RAG).

Voce digita um termo (ex: "desercao", "ferias", "portaria 123") e o sistema retorna trechos relevantes.

## 2) Modos de busca (o que acontece por tras)
Existem 2 componentes de busca:

1. Busca por texto (lexical, sem custo de IA)
   - Funciona mesmo sem API key.
   - Boa para termos exatos (ex: "Portaria 123").

2. Busca semantica (com IA / embeddings)
   - Precisa de uma Gemini API key valida.
   - Boa para conceitos (ex: "militar que some" -> acha "desercao", mesmo sem a palavra).

Quando ha API key, o botao **Buscar** faz uma busca **hibrida**:
- roda a busca por texto (rapida) e mostra resultado imediato
- em paralelo tenta a busca semantica
- no fim, combina os resultados e remove duplicatas por `id`

Para economizar quota, a busca semantica usa **cache local**: se voce buscar o mesmo termo novamente, o sistema reaproveita o vetor salvo no navegador e evita chamar o Gemini de novo.

## 3) Como usar (passo a passo)
1. Digite sua busca em "O que voce procura?"
2. (Opcional) Se quiser busca semantica:
   - Cole sua Gemini API Key no campo "Gemini API Key"
   - Clique em "Salvar Key"
3. Clique em "Buscar"
4. Veja os resultados na tabela

## 4) Preciso salvar a API Key toda vez?
Nao. A key fica salva no seu navegador via `appsmith.store` (client-side).

Voce normalmente so precisa salvar uma vez por navegador/dispositivo.

## 5) Como apagar a API Key
Clique no botao "Apagar Key".

Isso limpa `GEMINI_API_KEY` do `appsmith.store` (no seu navegador).

## 6) O que significam os campos da tabela?
- `tipo`: indica por que o resultado apareceu
  - (icone de lupa) = texto (lexical/FTS)
  - (icone de cerebro) = semantica (embedding)
  - (2 icones) = apareceu nos 2
- `conteudo_texto`: trecho retornado do indice
- `similarity`: score de similaridade (maior normalmente = mais perto)
- `id`: id do chunk no banco

## 7) Quota / uso restante
A tela mostra "Quota (estimativa local)".

Importante:
- isso **nao** e a quota oficial do Google
- e apenas um contador local para te dar nocao de quantas chamadas foram feitas na sessao
- quando o cache semantico e usado, **nao** incrementa o contador (porque nao chama o Gemini)

Para aumentar limites oficiais, normalmente e necessario configurar faturamento no projeto Google Cloud do API (isso pode exigir pre-pagamento).

## 8) Troubleshooting rapido
1. "Nao aconteceu nada" / tabela vazia
   - confira se o termo nao esta vazio
   - teste sem API key (vai usar busca por texto)
   - tente outro termo que exista no corpus

2. "Falha na busca"
   - a pagina mostra um texto de erro apenas depois de uma tentativa de busca (widget `Txt_Erro`)
   - no Editor do Appsmith: abra a aba `Queries` e rode:
     - `BuscarNormasFTS` (texto)
     - `GerarEmbedding2` e `BuscarNormas` (semantica)
   - verifique `Response`, `Logs` e `Errors` no painel inferior

3. "Semantica falhou; mantendo resultados por texto"
   - isso significa que a chamada de embeddings falhou (API key invalida, limite, rede, etc)
   - o sistema faz fallback e mantem a busca por texto funcionando

## 9) Seguranca (importante)
- Nao cole API keys em arquivos do repo nem em headers hardcoded de datasource.
- Se uma key/senha vazou em chat ou log, trate como comprometida e gere outra.
- Prefira usar a key no `appsmith.store` (client-side) como esta tela faz hoje.
