# Session Log - 2026-02-13

## Configuração: MCP Supabase no Antigravity (Global)

### O que foi feito
- Adicionado o servidor MCP `supabase` no arquivo global `c:\Users\jtnas\.gemini\antigravity\mcp_config.json`.
- Mantido o servidor MCP `n8n` existente sem alterações funcionais.
- Configuração principal aplicada para MCP remoto via HTTP:
  - `type: "http"`
  - `url: "https://mcp.supabase.com/mcp"`
- Criado arquivo de fallback com bridge `mcp-remote`:
  - `c:\Users\jtnas\.gemini\antigravity\mcp_config.supabase-fallback.json`
  - `command: "npx"`
  - `args: ["-y", "mcp-remote", "https://mcp.supabase.com/mcp"]`
- Realizado backup prévio do arquivo global:
  - `c:\Users\jtnas\.gemini\antigravity\mcp_config.json.bak-20260213-163710`

### Identificadores
- Endpoint MCP Supabase: `https://mcp.supabase.com/mcp`
- Arquivo principal: `c:\Users\jtnas\.gemini\antigravity\mcp_config.json`
- Arquivo fallback: `c:\Users\jtnas\.gemini\antigravity\mcp_config.supabase-fallback.json`

### Validação
- JSON válido após atualização (`ConvertFrom-Json` com sucesso).
- Encoding validado sem BOM:
  - assinatura inicial: `7B 0D 0A` (inicia com `{`).
- Conectividade endpoint MCP validada via HEAD:
  - `HEAD_STATUS=401` (esperado sem autenticação OAuth prévia).

### Ajuste (compatibilidade do cliente MCP)
- O cliente “Manage MCP servers” exibiu erro `serverUrl or command must be specified` ao ler `supabase` no formato `{ type, url }`.
- Correção aplicada: `supabase` passou a usar o campo `serverUrl` apontando para `https://mcp.supabase.com/mcp`.

## Configuração: MCP Supabase no Codex (config.toml)

### O que foi feito
- Adicionado o servidor MCP `supabase` no arquivo `c:\Users\jtnas\.codex\config.toml` usando transporte HTTP remoto via `url = "https://mcp.supabase.com/mcp"`.

### Identificadores
- Arquivo: `c:\Users\jtnas\.codex\config.toml`
- Endpoint MCP: `https://mcp.supabase.com/mcp`

### Validação
- Parse TOML: OK (validação local via `tomllib`).

### Segurança
- Nenhum token OAuth foi armazenado manualmente no TOML; a autenticação ocorre via UI do Codex quando solicitado.

### Segurança
- Nenhuma chave/senha nova foi gravada em documentação.
- Observação operacional: existe credencial sensível já presente no `mcp_config.json` (n8n). Recomendada rotação após estabilização do setup MCP.
