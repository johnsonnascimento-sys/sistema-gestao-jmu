# 🤖 Prompt do Gemini - Indexador Atômico

## Estrutura JSON Obrigatória (8 Campos)

```json
{
  "identificador": "RES-001-2024-C01",
  "dispositivo": "Art. 5º, §2º",
  "status_vigencia": "vigente",
  "conteudo_integral": "Texto completo do dispositivo legal...",
  "resumo_interpretativo": "Resumo claro em 2-3 frases do significado jurídico",
  "prazos_gatilhos": "30 dias corridos",
  "normas_alteradoras": "Portaria nº 123/2023",
  "tags_pentagonais": ["férias", "licença", "servidor", "direitos", "prazo"]
}
```

---

## Prompt Completo (Copiar para Node 6.5)

```
Você é um assistente especializado em análise de normas jurídicas da Justiça Militar da União.

TAREFA: Analise o trecho de norma fornecido e extraia EXATAMENTE as seguintes informações em formato JSON:

ESTRUTURA JSON OBRIGATÓRIA:
{
  "identificador": "string (ex: RES-001-2024-C01)",
  "dispositivo": "string (ex: Art. 5º, §2º ou Capítulo III)",
  "status_vigencia": "string (vigente | revogado | suspenso)",
  "conteudo_integral": "string (texto completo do dispositivo)",
  "resumo_interpretativo": "string (resumo claro em 2-3 frases)",
  "prazos_gatilhos": "string (prazos mencionados ou 'N/A')",
  "normas_alteradoras": "string (normas que alteram este dispositivo ou 'N/A')",
  "tags_pentagonais": ["array", "de", "strings", "com", "5", "tags", "relevantes"]
}

REGRAS CRÍTICAS:
1. O campo "identificador" DEVE ser exatamente: ${chunk.chunk_id}
2. Se não houver dispositivo específico (Art., §, etc.), use "Texto Geral"
3. "status_vigencia" deve ser SEMPRE "vigente" a menos que o texto mencione revogação
4. "prazos_gatilhos" deve listar prazos em dias/meses (ex: "30 dias", "6 meses") ou "N/A"
5. "tags_pentagonais" deve conter EXATAMENTE 5 tags em português, minúsculas, relevantes ao conteúdo

RETORNE APENAS O JSON, SEM TEXTO ADICIONAL.
```

---

## Exemplo de Resposta Esperada

**Input (Chunk de Norma):**
```
Art. 15. O servidor público militar terá direito a 30 (trinta) dias de férias anuais, 
podendo ser fracionadas em até 3 (três) períodos, mediante autorização do superior 
hierárquico. O gozo das férias deverá ser comunicado com antecedência mínima de 
15 (quinze) dias.
```

**Output (JSON do Gemini):**
```json
{
  "identificador": "RES-001-2024-C01",
  "dispositivo": "Art. 15",
  "status_vigencia": "vigente",
  "conteudo_integral": "O servidor público militar terá direito a 30 (trinta) dias de férias anuais, podendo ser fracionadas em até 3 (três) períodos, mediante autorização do superior hierárquico. O gozo das férias deverá ser comunicado com antecedência mínima de 15 (quinze) dias.",
  "resumo_interpretativo": "Estabelece o direito a 30 dias de férias anuais para servidores militares, permitindo fracionamento em até 3 períodos com autorização superior. Exige comunicação prévia de 15 dias para o gozo das férias.",
  "prazos_gatilhos": "30 dias (férias), 15 dias (antecedência para comunicação)",
  "normas_alteradoras": "N/A",
  "tags_pentagonais": ["férias", "servidor militar", "fracionamento", "autorização", "prazo"]
}
```

---

## Configuração no N8N

### Node: "Construir Prompt do Gemini" (Code)

**Localização:** Entre Node 5 (Loop) e Node 6 (Gemini HTTP Request)

**Variáveis dinâmicas:**
- `${chunk.chunk_id}` → Identificador único do chunk
- `${chunk.norma_vigente}` → Ex: "RES-001-2024"
- `${chunk.assunto}` → Ex: "Regulamento de Férias"
- `${chunk.orgao_emissor}` → Ex: "Justiça Militar da União"
- `${chunk.conteudo_bruto}` → Texto extraído do PDF

---

## Validação da Resposta

### Checklist (Node 7 - Code):
- ✅ JSON válido retornado
- ✅ Todos os 8 campos presentes
- ✅ `tags_pentagonais` é array com 5 elementos
- ✅ `status_vigencia` é um dos valores: vigente | revogado | suspenso
- ✅ `identificador` corresponde ao `chunk_id`

### Fallback em caso de erro:
```javascript
{
  identificador: chunk.chunk_id,
  dispositivo: "Erro na extração",
  status_vigencia: "vigente",
  conteudo_integral: chunk.conteudo_bruto.substring(0, 500),
  resumo_interpretativo: "Erro ao processar com IA",
  prazos_gatilhos: "N/A",
  normas_alteradoras: "N/A",
  tags_pentagonais: ["erro", "processamento", "ia", "revisar", "manual"]
}
```

---

## Otimizações

### Temperature: 0.1
- **Motivo:** Respostas mais determinísticas e consistentes
- **Efeito:** Reduz variabilidade na extração de dados estruturados

### Response MIME Type: application/json
- **Motivo:** Força o Gemini a retornar JSON válido
- **Efeito:** Reduz necessidade de parsing complexo

### Max Output Tokens: 2048
- **Motivo:** Suficiente para chunks de 3-5 páginas
- **Ajustar:** Se chunks maiores, aumentar para 4096

---

## Troubleshooting

### Problema: Gemini retorna texto em vez de JSON
**Solução:** Verificar `responseMimeType: "application/json"` no `generationConfig`

### Problema: Tags com menos de 5 elementos
**Solução:** Adicionar validação no Node 7 para preencher com tags genéricas

### Problema: Timeout na API do Gemini
**Solução:** Aumentar timeout do HTTP Request para 60 segundos

---

## Custo Estimado

**Modelo:** Gemini 1.5 Pro  
**Input:** ~1200 tokens/chunk (média)  
**Output:** ~500 tokens/chunk (média)  
**Custo:** ~$0.002 USD/chunk

**Exemplo:** Norma de 50 páginas = ~12 chunks = ~$0.024 USD
