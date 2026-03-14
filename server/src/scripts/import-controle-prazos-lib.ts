type RawCell = string | number | boolean | Date | null | undefined;

export interface ControlePrazosRawRow {
  "PRAZO 1"?: RawCell;
  "PRAZO 2"?: RawCell;
  "PRAZO 3"?: RawCell;
  FREQUENCIA?: RawCell;
  PAGAMENTO?: RawCell;
  "DATA AUDIENCIA"?: RawCell;
  AUDIENCIA?: RawCell;
  ASSUNTO?: RawCell;
  "NUMEROS E ASSOCIADOS"?: RawCell;
  "DATA DE INICIO"?: RawCell;
  "INTERESSADO 1"?: RawCell;
  "INTERESSADO 2"?: RawCell;
  "INTERESSADO 3"?: RawCell;
  HISTORICO?: RawCell;
  TAREFAS?: RawCell;
  "OBSERVAÇÃO"?: RawCell;
  "DATA DE CONCLUSAO"?: RawCell;
}

export interface ParsedAndamento {
  descricao: string;
  dataHora: string | null;
}

export interface ParsedDeadline {
  value: string | null;
  completed: boolean;
  warnings: string[];
  raw: string | null;
}

export interface ParsedControlePrazosRow {
  rowNumber: number;
  assunto: string;
  dataReferencia: string;
  observacoes: string | null;
  prazoInicial: ParsedDeadline;
  prazoIntermediario: ParsedDeadline;
  prazoFinal: ParsedDeadline;
  status: "aberta" | "associada" | "encerrada";
  dataConclusao: string | null;
  metadata: {
    frequencia: string | null;
    pagamentoEnvolvido: boolean | null;
    audienciaData: string | null;
    audienciaStatus: string | null;
  };
  seiNumbers: string[];
  seiOriginal: string | null;
  interessados: string[];
  historicoOriginal: string | null;
  andamentos: ParsedAndamento[];
  tarefas: string[];
  warnings: string[];
  errors: string[];
}

function asTrimmedString(value: RawCell) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).replace(/\u00a0/g, " ").trim();
}

function compactText(value: RawCell) {
  const text = asTrimmedString(value);
  return text ? text.replace(/[ \t]+/g, " ").trim() : "";
}

function excelSerialToDate(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

export function normalizeDateValue(value: RawCell): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToDate(value).toISOString().slice(0, 10);
  }

  const text = compactText(value);
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const ddmmyyyy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeDateTimeValue(value: string) {
  const normalized = value
    .replace(/,\s*/g, " ")
    .replace(/(\d{1,2})h(\d{2})/gi, "$1:$2")
    .replace(/(\d{1,2})[:h](\d{2})$/i, "$1:$2");

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?/i);
  if (!match) {
    return null;
  }

  const [, dd, mm, yyyy, hh = "00", min = "00"] = match;
  return `${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${min}:00.000Z`;
}

export function parseHistorico(value: RawCell): ParsedAndamento[] {
  const raw = asTrimmedString(value);
  if (!raw) {
    return [];
  }

  const normalized = raw.replace(/\r\n/g, "\n").trim();
  const blocks = normalized
    .split(/\n\s*\n+/)
    .flatMap((chunk) => {
      const lines = chunk
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length <= 1) {
        return [chunk.trim()];
      }

      const grouped: string[] = [];
      let current = "";
      for (const line of lines) {
        if (/^\d{2}\/\d{2}\/\d{4}/.test(line) && current) {
          grouped.push(current.trim());
          current = line;
        } else {
          current = current ? `${current}\n${line}` : line;
        }
      }
      if (current) {
        grouped.push(current.trim());
      }
      return grouped;
    })
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const dateMatch = block.match(/^(\d{2}\/\d{2}\/\d{4}(?:[^\n]*)?)/);
    const capturedDate = dateMatch?.[1];
    const dataHora = capturedDate ? normalizeDateTimeValue(capturedDate) : null;
    return {
      descricao: block,
      dataHora,
    };
  });
}

export function parseTasks(value: RawCell) {
  const raw = asTrimmedString(value);
  if (!raw) {
    return [];
  }

  const candidates = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return candidates.length > 1 ? candidates : [raw.trim()];
}

export function parseSeiNumbers(value: RawCell) {
  const raw = asTrimmedString(value);
  if (!raw) {
    return [];
  }

  const matches = raw.match(/\d{6}\/\d{2}-\d{2}\.\d{3}|\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g);
  return Array.from(new Set((matches ?? []).map((item) => item.trim()).filter(Boolean)));
}

export function parseInterested(raw: ControlePrazosRawRow) {
  const candidates = [raw["INTERESSADO 1"], raw["INTERESSADO 2"], raw["INTERESSADO 3"]]
    .map((value) => compactText(value))
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.toLocaleLowerCase("pt-BR");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(candidate);
    }
  }

  return deduped;
}

export function parseDeadline(value: RawCell, label: string): ParsedDeadline {
  const raw = compactText(value);
  if (!raw) {
    return { value: null, completed: false, warnings: [], raw: null };
  }

  if (/^feita?$|^feito$/i.test(raw)) {
    return { value: null, completed: true, warnings: [], raw };
  }

  const normalized = normalizeDateValue(value);
  if (!normalized) {
    return { value: null, completed: false, warnings: [`${label}: valor nao reconhecido (${raw}).`], raw };
  }

  const year = Number(normalized.slice(0, 4));
  if (year < 2000) {
    return { value: null, completed: false, warnings: [`${label}: data sentinela descartada (${raw}).`], raw };
  }

  return { value: normalized, completed: false, warnings: [], raw };
}

function parsePagamento(value: RawCell) {
  const raw = compactText(value);
  if (!raw) {
    return null;
  }

  if (/^sim$/i.test(raw)) {
    return true;
  }

  if (/^nao$|^não$/i.test(raw)) {
    return false;
  }

  return null;
}

function inferStatus(input: { prazoInicial: ParsedDeadline; dataConclusao: string | null; seiNumbers: string[] }) {
  if (input.prazoInicial.completed) {
    return "encerrada" as const;
  }
  if (input.dataConclusao) {
    return "encerrada" as const;
  }
  if (input.seiNumbers.length > 0) {
    return "associada" as const;
  }
  return "aberta" as const;
}

export function buildImportAnnotation(params: { filePath: string; sheetName: string; rowNumber: number; warnings: string[] }) {
  const lines = [
    "[IMPORT_CONTROLE_PRAZOS]",
    `arquivo=${params.filePath}`,
    `aba=${params.sheetName}`,
    `linha=${params.rowNumber}`,
    `importado_em=${new Date().toISOString()}`,
  ];

  if (params.warnings.length) {
    lines.push(`warnings=${params.warnings.join(" | ")}`);
  }

  return lines.join("\n");
}

export function parseControlePrazosRow(raw: ControlePrazosRawRow, rowNumber: number): ParsedControlePrazosRow {
  const assunto = compactText(raw.ASSUNTO);
  const dataReferencia = normalizeDateValue(raw["DATA DE INICIO"]);
  const observacoes = compactText(raw["OBSERVAÇÃO"]) || null;
  const prazoInicial = parseDeadline(raw["PRAZO 1"], "PRAZO 1");
  const prazoIntermediario = parseDeadline(raw["PRAZO 2"], "PRAZO 2");
  const prazoFinal = parseDeadline(raw["PRAZO 3"], "PRAZO 3");
  const dataConclusao = normalizeDateValue(raw["DATA DE CONCLUSAO"]);
  const seiOriginal = compactText(raw["NUMEROS E ASSOCIADOS"]) || null;
  const seiNumbers = parseSeiNumbers(raw["NUMEROS E ASSOCIADOS"]);
  const interessados = parseInterested(raw);
  const andamentos = parseHistorico(raw.HISTORICO);
  const tarefas = parseTasks(raw.TAREFAS);
  const warnings = [...prazoInicial.warnings, ...prazoIntermediario.warnings, ...prazoFinal.warnings];
  const errors: string[] = [];

  if (!assunto) {
    errors.push("ASSUNTO vazio.");
  }

  if (!dataReferencia) {
    errors.push("DATA DE INICIO ausente ou invalida.");
  }

  if (!interessados.length) {
    errors.push("Nenhum interessado identificado.");
  }

  return {
    rowNumber,
    assunto,
    dataReferencia: dataReferencia ?? "",
    observacoes,
    prazoInicial,
    prazoIntermediario,
    prazoFinal,
    status: inferStatus({ prazoInicial, dataConclusao, seiNumbers }),
    dataConclusao,
    metadata: {
      frequencia: compactText(raw.FREQUENCIA) || null,
      pagamentoEnvolvido: parsePagamento(raw.PAGAMENTO),
      audienciaData: normalizeDateValue(raw["DATA AUDIENCIA"]),
      audienciaStatus: compactText(raw.AUDIENCIA) || null,
    },
    seiNumbers,
    seiOriginal,
    interessados,
    historicoOriginal: asTrimmedString(raw.HISTORICO) || null,
    andamentos,
    tarefas,
    warnings,
    errors,
  };
}
