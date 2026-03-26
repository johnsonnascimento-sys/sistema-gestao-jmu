#!/bin/bash

# ==========================================
# BOOTLOADER DO AGENTE DE IA
# Copia o contexto mestre para a area de transferencia
# ==========================================

set -euo pipefail

CONTEXT_FILE="AI_BOOTLOADER.md"

if [ ! -f "$CONTEXT_FILE" ]; then
    echo "Erro: Arquivo '$CONTEXT_FILE' nao encontrado na raiz!"
    exit 1
fi

CONTENT=$(cat "$CONTEXT_FILE")

PROMPT="CONTEXTO MESTRE DO PROJETO (JMU):\n\n$CONTENT\n\n---\n\nAGENTE: Leia o contexto acima com cuidado. O sistema atual e o Gestor Web proprio em React + Fastify + PostgreSQL.\nAppsmith, n8n e RAG estao fora do runtime atual e nao devem ser retomados sem instrucao explicita.\n\nProssiga a partir da arquitetura e do runbook atuais do Gestor Web."

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v xclip &> /dev/null; then
        echo -e "$PROMPT" | xclip -selection clipboard
    elif command -v xsel &> /dev/null; then
        echo -e "$PROMPT" | xsel --clipboard --input
    else
        echo "Aviso: 'xclip' ou 'xsel' nao instalados. Apenas exibindo o texto abaixo:"
        echo "------------------------------------------------"
        echo -e "$PROMPT"
        echo "------------------------------------------------"
        exit 0
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "$PROMPT" | pbcopy
else
    if command -v clip.exe &> /dev/null; then
        echo -e "$PROMPT" | clip.exe
    else
        echo "Aviso: 'clip.exe' nao encontrado. Apenas exibindo o texto abaixo:"
        echo "------------------------------------------------"
        echo -e "$PROMPT"
        echo "------------------------------------------------"
        exit 0
    fi
fi

echo "Contexto copiado com sucesso!"
