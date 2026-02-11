param(
  [string]$Url = "https://n8n.johnsontn.com.br/mcp-server/http"
)

$ErrorActionPreference = "Stop"

$token = $env:N8N_MCP_BEARER

$secretsPath = Join-Path $PSScriptRoot "..\MEUS_SEGREDOS.txt"

# Fallback: Tentar ler do arquivo MEUS_SEGREDOS.txt se a env var nao estiver definida
if ([string]::IsNullOrWhiteSpace($token)) {
  if (Test-Path $secretsPath) {
    $content = Get-Content -LiteralPath $secretsPath
    foreach ($line in $content) {
      if ($line -match "API Key:\s*(.+)") {
        $token = $matches[1].Trim()
        # Output to stderr instead of stdout
        [Console]::Error.WriteLine("Usando credencial encontrada em MEUS_SEGREDOS.txt")
        break
      }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error "Env var N8N_MCP_BEARER nao definida e token nao encontrado em MEUS_SEGREDOS.txt."
  exit 1
}

# ==========================================
# Configuração das variáveis de ambiente para o mcp-n8n
# ==========================================

# Mapear o token encontrado para N8N_API_KEY (usado pelo mcp-n8n)
$env:N8N_API_KEY = $token

# Tentar encontrar a URL do N8N em MEUS_SEGREDOS.txt
$n8nUrl = "https://n8n.johnsontn.com.br" # Default known URL
if (Test-Path $secretsPath) {
  $content = Get-Content -LiteralPath $secretsPath
  foreach ($line in $content) {
    if ($line -match "URL:\s*(.+n8n.+)") {
      $n8nUrl = $matches[1].Trim()
      break
    }
  }
}
$env:N8N_BASE_URL = $n8nUrl

# Logs movidos para stderr (Write-Error ou [Console]::Error) para evitar poluir o stdout do MCP
# [Console]::Error.WriteLine("Iniciando mcp-n8n...")
# [Console]::Error.WriteLine("N8N_HOST: $env:N8N_HOST")
# [Console]::Error.WriteLine("N8N_API_KEY: [HIDDEN]")

# Debug logging
$logPath = Join-Path $PSScriptRoot "..\debug_mcp.log"
"$(Get-Date) - Starting n8n-mcp.ps1" | Out-File -FilePath $logPath -Append
"$(Get-Date) - N8N_BASE_URL: $env:N8N_BASE_URL" | Out-File -FilePath $logPath -Append

# Executar o servidor MCP do N8n oficial da comunidade
# Usamos npx para garantir a versão mais recente sem instalar globalmente
try {
  npx -y mcp-n8n 2>> $logPath
}
catch {
  "$(Get-Date) - Error: $_" | Out-File -FilePath $logPath -Append
}

