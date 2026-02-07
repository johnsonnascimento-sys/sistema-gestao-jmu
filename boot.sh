#!/bin/bash

# ==========================================
# BOOTLOADER DO AGENTE DE IA
# Copia o contexto mestre para a área de transferência
# ==========================================

set -euo pipefail

CONTEXT_FILE="AI_BOOTLOADER.md"

# 1. Verifica se o arquivo existe
if [ ! -f "$CONTEXT_FILE" ]; then
    echo "❌ Erro: Arquivo '$CONTEXT_FILE' não encontrado na raiz!"
    exit 1
fi

# 2. Lê o conteúdo
CONTENT=$(cat "$CONTEXT_FILE")

# 3. Monta o Prompt Perfeito
PROMPT="CONTEXTO MESTRE DO PROJETO (JMU):\n\n$CONTENT\n\n---\n\nAGENTE: Leia o status acima com atenção. O Backend (N8N/Banco) JÁ ESTÁ PRONTO. Não tente recriá-lo.\n\nAguardo sua confirmação para prosseguirmos com o DEPLOY DO APPSMITH."

# 4. Copia para o Clipboard (Compatível com Linux, Mac, Windows/WSL)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Tenta usar xclip, se falhar tenta xsel
    if command -v xclip &> /dev/null; then
        echo -e "$PROMPT" | xclip -selection clipboard
    elif command -v xsel &> /dev/null; then
        echo -e "$PROMPT" | xsel --clipboard --input
    else
        echo "⚠️  Aviso: 'xclip' ou 'xsel' não instalados. Apenas exibindo o texto abaixo:"
        echo "------------------------------------------------"
        echo -e "$PROMPT"
        echo "------------------------------------------------"
        exit 0
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac
    echo -e "$PROMPT" | pbcopy
else
    # Windows (Git Bash / WSL com clip.exe)
    if command -v clip.exe &> /dev/null; then
        echo -e "$PROMPT" | clip.exe
    else
        echo "⚠️  Aviso: 'clip.exe' não encontrado. Apenas exibindo o texto abaixo:"
        echo "------------------------------------------------"
        echo -e "$PROMPT"
        echo "------------------------------------------------"
        exit 0
    fi
fi

echo "✅ Contexto copiado com sucesso!"
echo "👉 Vá no Chat da IDE agora e pressione Ctrl+V (ou Cmd+V)."

