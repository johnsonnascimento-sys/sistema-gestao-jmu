$ErrorActionPreference = 'Stop'

# ==========================================
# BOOTLOADER DO AGENTE DE IA (Windows/PowerShell)
# Copia o contexto mestre para a area de transferencia
# ==========================================

$ContextFile = Join-Path $PSScriptRoot 'AI_BOOTLOADER.md'

if (-not (Test-Path -LiteralPath $ContextFile)) {
  Write-Host "Erro: Arquivo '$ContextFile' nao encontrado na raiz!"
  exit 1
}

$content = Get-Content -LiteralPath $ContextFile -Raw
$prompt = @"
CONTEXTO MESTRE DO PROJETO (JMU):

$content

---

AGENTE: Leia o contexto acima com cuidado. O sistema atual e o Gestor Web proprio em React + Fastify + PostgreSQL.
Appsmith, n8n e RAG estao fora do runtime atual e nao devem ser retomados sem instrucao explicita.

Prossiga a partir da arquitetura e do runbook atuais do Gestor Web.
"@

if (Get-Command -Name Set-Clipboard -ErrorAction SilentlyContinue) {
  Set-Clipboard -Value $prompt
  Write-Host "Contexto copiado com sucesso (Set-Clipboard)."
  exit 0
}

if (Get-Command -Name clip.exe -ErrorAction SilentlyContinue) {
  $prompt | clip.exe
  Write-Host "Contexto copiado com sucesso (clip.exe)."
  exit 0
}

Write-Host "Aviso: Nao consegui copiar para o clipboard automaticamente. Conteudo abaixo:"
Write-Host "------------------------------------------------"
Write-Host $prompt
Write-Host "------------------------------------------------"
exit 0
