# Como Configurar MCP N8n no Antigravity

## Visão Geral

Este documento descreve a configuração do servidor MCP (Model Context Protocol) do N8n no Antigravity, permitindo controle total dos workflows do N8n diretamente da IDE sem necessidade de abrir o navegador.

## Arquitetura da Solução

```
Antigravity IDE
    ↓
mcp_config.json (UTF-8 sem BOM)
    ↓
node.exe → mcp-n8n (local)
    ↓
N8n API (https://n8n.johnsontn.com.br)
```

## Arquivos Envolvidos

### 1. Configuração Principal
**Localização:** `c:\Users\jtnas\.gemini\antigravity\mcp_config.json`

**Conteúdo:**
```json
{
  "mcpServers": {
    "n8n": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "c:\\Users\\jtnas\\.gemini\\antigravity\\scratch\\sistema-gestao-jmu\\node_modules\\mcp-n8n\\dist\\index.js"
      ],
      "env": {
        "N8N_API_KEY": "eyJhbGci...",
        "N8N_BASE_URL": "https://n8n.johnsontn.com.br"
      }
    }
  }
}
```

### 2. Módulo MCP N8n
**Localização:** `node_modules/mcp-n8n/` (instalado localmente no projeto)

**Instalação:**
```bash
cd c:\Users\jtnas\.gemini\antigravity\scratch\sistema-gestao-jmu
npm install mcp-n8n
```

### 3. Regra de Proteção Global
**Localização:** `c:\Users\jtnas\.gemini\GEMINI.md`

Contém regra que **proíbe** modificações diretas ao `mcp_config.json` via ferramentas de edição de arquivo do Antigravity.

## ⚠️ PROBLEMA CRÍTICO: BOM (Byte Order Mark)

### O Que É o BOM?
BOM (Byte Order Mark) são 3 bytes invisíveis (`EF BB BF`) que algumas ferramentas adicionam no início de arquivos UTF-8. Muitos parsers JSON rejeitam arquivos com BOM **silenciosamente**.

### Como o Problema Foi Descoberto
1. O arquivo `mcp_config.json` estava correto em formato e localização
2. O Antigravity não listava o servidor `n8n` no menu "Manage MCPs"
3. Investigação revelou que o arquivo começava com `EF BB BF` em vez de `7B` (`{`)

### Sintomas do Problema
- Servidor não aparece na lista de MCPs disponíveis
- Erro: `server name n8n not found`
- Nenhum processo `node.exe` sendo iniciado pelo Antigravity

## ✅ SOLUÇÃO: UTF-8 Sem BOM

### Método Correto de Edição

**NUNCA use `write_to_file` ou `replace_file_content` do Antigravity** para editar `mcp_config.json`.

**Use PowerShell com encoding explícito:**

```powershell
$content = @'
{
  "mcpServers": {
    "n8n": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "c:\\Users\\jtnas\\.gemini\\antigravity\\scratch\\sistema-gestao-jmu\\node_modules\\mcp-n8n\\dist\\index.js"
      ],
      "env": {
        "N8N_API_KEY": "sua-api-key-aqui",
        "N8N_BASE_URL": "https://n8n.johnsontn.com.br"
      }
    }
  }
}
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("C:\Users\jtnas\.gemini\antigravity\mcp_config.json", $content, $utf8NoBom)
```

### Verificação do Encoding

```powershell
$bytes = [System.IO.File]::ReadAllBytes("C:\Users\jtnas\.gemini\antigravity\mcp_config.json")
$hex = ($bytes[0..3] | ForEach-Object { "{0:X2}" -f $_ }) -join " "
Write-Host "Primeiros bytes: $hex"
```

**Resultado esperado:** `7B 0A 20 20` (sem `EF BB BF`)

## Uso do MCP N8n

### Ferramentas Disponíveis

O servidor MCP `n8n` expõe **tools** (não resources). Principais ferramentas:

- `n8n_list_workflows_summary` - Lista workflows (id, nome, status)
- `n8n_list_workflows` - Lista workflows com detalhes completos
- `n8n_get_workflow` - Obtém workflow específico
- `n8n_activate_workflow` - Ativa workflow
- `n8n_deactivate_workflow` - Desativa workflow
- `n8n_list_executions` - Lista execuções
- `n8n_get_execution` - Obtém execução específica

### Exemplo de Uso

```
Agente: Liste os workflows do N8n
[Chama n8n_list_workflows_summary]
Resultado: 9 workflows (3 ativos, 6 inativos)
```

## Troubleshooting

### Servidor não aparece na lista
1. Verifique se `mcp_config.json` não tem BOM
2. Reinicie o Antigravity (Reload Window)
3. Verifique se `node_modules/mcp-n8n` existe

### Erro "Method not found"
- Normal para `list_resources` - use tools específicos do n8n

### Erro "unknown MCP server 'n8n'"
- Servidor não foi carregado
- Verifique encoding do arquivo (sem BOM)
- Reinicie o Antigravity

## Alternativa: Script CLI

Se o MCP não estiver disponível, use o script `n8n_manager.js`:

```bash
node n8n_manager.js list
node n8n_manager.js start <workflow-id>
node n8n_manager.js stop <workflow-id>
```

## Segurança

- A API Key está em texto puro no `mcp_config.json`
- O arquivo está fora do repositório Git
- Acesso local apenas
- Considere rotacionar a chave periodicamente

## Histórico de Resolução

**Problema:** Configuração correta mas servidor não carregava  
**Causa Raiz:** BOM (UTF-8 com Byte Order Mark)  
**Solução:** Reescrever arquivo com UTF-8 sem BOM via PowerShell  
**Data:** 2026-02-11  
**Conversação:** 516be14d-e8fc-4993-a05d-bc08a9f027b0
