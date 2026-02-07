param(
  [string]$Url = "https://n8n.johnsontn.com.br/mcp-server/http"
)

$ErrorActionPreference = "Stop"

$token = $env:N8N_MCP_BEARER
if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error "Env var N8N_MCP_BEARER nao definida. Defina o Bearer token do MCP do n8n antes de iniciar."
  exit 1
}

# Start supergateway (installed on-demand via npx).
# We keep the token out of config files and pass it at runtime.
npx -y supergateway --streamableHttp $Url --header "authorization:Bearer $token"

