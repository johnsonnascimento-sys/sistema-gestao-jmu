param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$secretsPath = Join-Path $repoRoot "MEUS_SEGREDOS.txt"

function Read-SecretLine([string]$pattern) {
  if (-not (Test-Path -LiteralPath $secretsPath)) { return $null }
  $content = Get-Content -LiteralPath $secretsPath
  foreach ($line in $content) {
    if ($line -match $pattern) {
      return $matches[1].Trim()
    }
  }
  return $null
}

# Prefer env vars, fallback to MEUS_SEGREDOS.txt (gitignored).
$appUrl = $env:APPSMITH_URL
$appEmail = $env:APPSMITH_EMAIL
$appPassword = $env:APPSMITH_PASSWORD

if ([string]::IsNullOrWhiteSpace($appUrl)) { $appUrl = Read-SecretLine "APPSMITH_URL:\s*(.+)$" }
if ([string]::IsNullOrWhiteSpace($appEmail)) { $appEmail = Read-SecretLine "APPSMITH_EMAIL:\s*(.+)$" }
if ([string]::IsNullOrWhiteSpace($appPassword)) { $appPassword = Read-SecretLine "APPSMITH_PASSWORD:\s*(.+)$" }

if ([string]::IsNullOrWhiteSpace($appUrl)) {
  Write-Error "APPSMITH_URL nao definido (env var) e nao encontrado em MEUS_SEGREDOS.txt."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($appEmail) -or [string]::IsNullOrWhiteSpace($appPassword)) {
  Write-Error "APPSMITH_EMAIL/APPSMITH_PASSWORD ausentes. Defina via env vars ou MEUS_SEGREDOS.txt (gitignored)."
  exit 1
}

$env:APPSMITH_URL = $appUrl
$env:APPSMITH_EMAIL = $appEmail
$env:APPSMITH_PASSWORD = $appPassword

# Optional: per-request timeout (ms). If absent, server defaults to 30000.
if ([string]::IsNullOrWhiteSpace($env:APPSMITH_TIMEOUT_MS)) {
  $env:APPSMITH_TIMEOUT_MS = "30000"
}

# Debug log to file (never stdout).
$logDir = Join-Path $repoRoot "tmp\\appsmith"
New-Item -ItemType Directory -Force $logDir | Out-Null
$logPath = Join-Path $logDir "mcp-debug.log"
"$(Get-Date -Format o) - Starting appsmith-mcp.ps1" | Out-File -FilePath $logPath -Append

Push-Location $repoRoot
try {
  node "mcp/appsmith-mcp-server.js" 2>> $logPath
}
finally {
  Pop-Location
}
