# Como Configurar MCP Appsmith (Codex)

Este repo inclui um MCP server custom para Appsmith, permitindo automatizar:
- login/whoami/health
- listar workspaces/apps/pages/actions
- criar datasources/actions
- fetch/save DSL e upsert de widgets (FIXED layout)
- export/import de apps

Arquivos:
- `mcp/appsmith-mcp-server.js` (server MCP via stdio)
- `mcp/appsmith-mcp.ps1` (wrapper PowerShell para ler segredos e iniciar o server)

## Pre-requisitos
- Node.js instalado
- Dependencias instaladas no repo: `npm ci` (ou `npm install`)

## Segredos (local, nao versionar)
O wrapper le `MEUS_SEGREDOS.txt` (ja esta no `.gitignore`).

Formato esperado (uma linha por chave):
- `APPSMITH_URL: https://app.seudominio.com.br`
- `APPSMITH_EMAIL: seu-email`
- `APPSMITH_PASSWORD: sua-senha`

Regras:
- Nao commitar este arquivo.
- Se senha/token vazou em chat/logs, trate como comprometido e rotacione.

## Como iniciar o MCP server localmente
No PowerShell (na raiz do repo):
```powershell
powershell -ExecutionPolicy Bypass -File .\\mcp\\appsmith-mcp.ps1
```

## Como registrar no Codex
Edite o arquivo do Codex (usuario):
- `C:\\Users\\<voce>\\.codex\\config.toml`

Exemplo (ajuste o caminho do repo):
```toml
[mcp_servers.appsmith]
command = "powershell"
args = ["-ExecutionPolicy", "Bypass", "-File", "C:\\\\caminho\\\\para\\\\sistema-gestao-jmu\\\\mcp\\\\appsmith-mcp.ps1"]
```

Depois reinicie o Codex/IDE para recarregar os MCP servers.

## Troubleshooting
- Se `login()` falhar:
  - confirme `APPSMITH_URL` (sem `/setup/welcome`)
  - confirme email/senha
  - valide acesso ao endpoint `/api/v1/health`
- Se `upsert_widgets` falhar:
  - a tool assume pagina em layout FIXED (AutoLayout precisa suporte adicional)

