# 🔧 Como Configurar o MCP N8N no Antigravity

## 📋 Pré-requisitos

- Antigravity instalado
- N8N rodando em `https://n8n.johnsontn.com.br`
- API Key do N8N

## 🚀 Passos para Configuração

### 1. Criar o Script PowerShell do MCP

Criar o arquivo: `c:\Users\jtnas\.gemini\antigravity\mcp\n8n-mcp.ps1`

```powershell
# Ativa o ambiente virtual do MCP N8N
& "C:\Users\jtnas\.gemini\antigravity\mcp\n8n-mcp-venv\Scripts\Activate.ps1"

# Executa o servidor MCP N8N
python -m mcp_server_n8n
```

### 2. Criar o Ambiente Virtual

```powershell
# Navegar para o diretório MCP
cd c:\Users\jtnas\.gemini\antigravity\mcp

# Criar ambiente virtual
python -m venv n8n-mcp-venv

# Ativar ambiente virtual
.\n8n-mcp-venv\Scripts\Activate.ps1

# Instalar o pacote MCP N8N
pip install mcp-server-n8n
```

### 3. Configurar o mcp_config.json

**⚠️ CRÍTICO: Este arquivo DEVE ser UTF-8 SEM BOM!**

Criar/editar: `c:\Users\jtnas\.gemini\antigravity\mcp_config.json`

```json
{
  "mcpServers": {
    "n8n": {
      "command": "powershell.exe",
      "args": [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "C:\\Users\\jtnas\\.gemini\\antigravity\\mcp\\n8n-mcp.ps1"
      ],
      "env": {
        "N8N_API_KEY": "SUA_API_KEY_AQUI",
        "N8N_BASE_URL": "https://n8n.johnsontn.com.br"
      }
    }
  }
}
```

**Como salvar corretamente (UTF-8 sem BOM):**

```powershell
# Usar PowerShell para garantir encoding correto
$content = Get-Content "c:\Users\jtnas\.gemini\antigravity\mcp_config.json" -Raw
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("c:\Users\jtnas\.gemini\antigravity\mcp_config.json", $content, $utf8NoBom)
```

### 4. Obter a API Key do N8N

1. Acesse: `https://n8n.johnsontn.com.br`
2. Vá em **Settings** (Configurações)
3. Vá em **API**
4. Clique em **Create API Key**
5. Copie a chave gerada
6. Cole no `mcp_config.json` no campo `N8N_API_KEY`

### 5. Reiniciar o Antigravity

Após configurar tudo, reinicie o Antigravity para carregar o servidor MCP.

## ✅ Verificação

Após reiniciar, você deve ver o servidor `n8n` disponível nos servidores MCP do Antigravity.

Você poderá usar ferramentas como:
- `mcp_n8n_n8n_list_workflows_summary`
- `mcp_n8n_n8n_create_workflow`
- `mcp_n8n_n8n_create_credential`
- E muitas outras...

## 🔍 Troubleshooting

### Erro: "Servidor MCP não encontrado"
- Verifique se o caminho do script está correto
- Verifique se o ambiente virtual foi criado corretamente

### Erro: "Encoding inválido"
- O arquivo `mcp_config.json` deve ser UTF-8 **SEM BOM**
- Use o comando PowerShell acima para corrigir

### Erro: "API Key inválida"
- Verifique se a API Key está correta
- Verifique se a URL do N8N está acessível

## 📁 Estrutura de Arquivos

```
c:\Users\jtnas\.gemini\antigravity\
├── mcp_config.json (UTF-8 SEM BOM!)
└── mcp\
    ├── n8n-mcp.ps1
    └── n8n-mcp-venv\
        └── Scripts\
            ├── Activate.ps1
            └── python.exe
```

## 🎯 Credencial Google Sheets Criada

Já criamos a credencial do Google Sheets via MCP:
- **Nome:** Google Sheets - JMU Automation (Service Account)
- **ID:** `A8137sqsd18zeI5F`
- **E-mail do robô:** `n8n-bot@jmu-automation.iam.gserviceaccount.com`

Lembre-se de compartilhar suas planilhas com este e-mail!
