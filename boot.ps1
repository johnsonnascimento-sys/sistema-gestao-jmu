$ErrorActionPreference = 'Stop'

# ==========================================
# BOOTLOADER DO AGENTE DE IA (Windows/PowerShell)
# Copia o contexto mestre para a área de transferência
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

AGENTE: Leia o status acima com atencao. O Backend (N8N/Banco) JA ESTA PRONTO. Nao tente recria-lo.

Aguardo sua confirmacao para prosseguirmos com o DEPLOY DO APPSMITH.
"@

if (Get-Command -Name Set-Clipboard -ErrorAction SilentlyContinue) {
  Set-Clipboard -Value $prompt
  Write-Host "Contexto copiado com sucesso (Set-Clipboard)."
  exit 0
}

# Fallback: clip.exe
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

