param(
  [string]$Url = "https://n8n.johnsontn.com.br/mcp-server/http"
)

$ErrorActionPreference = "Stop"

$token = $env:N8N_MCP_BEARER

# Fallback: Tentar ler do arquivo MEUS_SEGREDOS.txt se a env var nao estiver definida
if ([string]::IsNullOrWhiteSpace($token)) {
  $secretsPath = Join-Path $PSScriptRoot "..\MEUS_SEGREDOS.txt"
  if (Test-Path $secretsPath) {
    $content = Get-Content -LiteralPath $secretsPath
    foreach ($line in $content) {
      if ($line -match "API Key:\s*(.+)") {
        $token = $matches[1].Trim()
        Write-Host "Usando credencial encontrada em MEUS_SEGREDOS.txt" -ForegroundColor Cyan
        break
      }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error "Env var N8N_MCP_BEARER nao definida e token nao encontrado em MEUS_SEGREDOS.txt."
  exit 1
}

# Start supergateway (installed on-demand via npx).
# We keep the token out of config files and pass it at runtime.
npx -y supergateway --streamableHttp $Url --header "authorization:Bearer $token"

