import type { TarefaRelatorioQuery, TarefaRelatorioResult } from "../domain/types";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 42;

function pdfText(value: string) {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\xFF]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value: string, width: number, fontSize: number) {
  const maxChars = Math.max(20, Math.floor(width / (fontSize * 0.52)));
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem prazo";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function filterDescription(query: TarefaRelatorioQuery) {
  const parts = [
    query.status === "pendentes" ? "Somente pendentes" : query.status === "concluidas" ? "Somente concluidas" : "Pendentes e concluidas",
    query.dueFrom || query.dueTo ? `Prazo ${formatDate(query.dueFrom)} a ${formatDate(query.dueTo)}` : null,
    query.urgency === "urgentes" ? "Urgentes" : query.urgency === "nao_urgentes" ? "Nao urgentes" : "Todas as urgencias",
    query.recurrence ? `Recorrencia: ${query.recurrence}` : null,
    query.q ? `Pesquisa: ${query.q}` : null,
  ];
  return parts.filter(Boolean).join(" | ");
}

/** Produz um PDF vetorial com fontes-base do PDF, portanto pesquisável e selecionável. */
export function createTaskReportPdf(report: TarefaRelatorioResult, query: TarefaRelatorioQuery) {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;
  const addPage = () => {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    y = PAGE_HEIGHT - MARGIN;
  };
  const line = (text: string, options: { size?: number; bold?: boolean; indent?: number; leading?: number } = {}) => {
    const size = options.size ?? 9;
    const leading = options.leading ?? size * 1.38;
    if (y - leading < MARGIN) addPage();
    commands.push(`BT /${options.bold ? "F2" : "F1"} ${size} Tf ${MARGIN + (options.indent ?? 0)} ${y} Td (${pdfText(text)}) Tj ET`);
    y -= leading;
  };
  const wrapped = (text: string, options: { size?: number; bold?: boolean; indent?: number } = {}) => {
    const size = options.size ?? 9;
    const indent = options.indent ?? 0;
    for (const item of wrapText(text, PAGE_WIDTH - (MARGIN * 2) - indent, size)) line(item, { ...options, size, indent });
  };

  line("RELATORIO DE TAREFAS", { size: 16, bold: true, leading: 24 });
  line(`Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")}`, { size: 8 });
  wrapped(`Filtros: ${filterDescription(query)}`, { size: 8 });
  y -= 4;
  line(`Tarefas: ${report.summary.total} | Pendentes: ${report.summary.pendentes} | Concluidas: ${report.summary.concluidas} | Urgentes: ${report.summary.urgentes} | Atrasadas: ${report.summary.atrasadas}`, { size: 9, bold: true, leading: 18 });

  line("PAUTA JUDICIAL - PROCESSOS COM AUDIENCIA DESIGNADA", { size: 11, bold: true, leading: 20 });
  if (report.audienciasDesignadas.length === 0) {
    line("Nenhuma audiencia designada neste recorte.", { size: 9 });
  } else {
    for (const hearing of report.audienciasDesignadas) {
      wrapped(`${hearing.preNumero} - ${hearing.assunto}`, { size: 10, bold: true });
      line(`Audiencia: ${new Date(hearing.dataHoraInicio).toLocaleString("pt-BR")}`, { size: 9, indent: 10 });
      if (hearing.descricao ?? hearing.observacoes) wrapped(hearing.descricao ?? hearing.observacoes ?? "", { size: 8, indent: 10 });
      if (hearing.tarefasPendentes.length === 0) line("Sem tarefas pendentes.", { size: 8, indent: 10 });
      for (const task of hearing.tarefasPendentes) {
        wrapped(`${task.descricao} | Prazo: ${formatDate(task.prazoConclusao)} | Tipo: ${task.tipo}${task.urgente ? " | URGENTE" : ""}`, { size: 8, indent: 20 });
      }
      y -= 4;
    }
  }

  const hearingPreIds = new Set(report.audienciasDesignadas.map((item) => item.preId));
  const remainingTasks = report.items.filter((item) => !hearingPreIds.has(item.preId));
  line("DEMAIS TAREFAS", { size: 11, bold: true, leading: 20 });
  if (remainingTasks.length === 0) {
    line("Nenhuma tarefa nesta secao.", { size: 9 });
  } else {
    for (const task of remainingTasks) {
      wrapped(`${task.preNumero} - ${task.assunto}`, { size: 9, bold: true });
      wrapped(`${task.descricao} | Prazo: ${formatDate(task.prazoConclusao)} | Tipo: ${task.tipo}${task.urgente ? " | URGENTE" : ""}`, { size: 8, indent: 10 });
      y -= 3;
    }
  }
  pages.push(commands.join("\n"));

  const objects: Array<{ id: number; value: string }> = [
    { id: 1, value: "<< /Type /Catalog /Pages 2 0 R >>" },
    { id: 3, value: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
    { id: 4, value: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>" },
  ];
  const pageIds: number[] = [];
  pages.forEach((content, index) => {
    const pageId = 5 + (index * 2);
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const stream = `${content}\n`;
    objects.push({ id: pageId, value: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>` });
    objects.push({ id: contentId, value: `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream` });
  });
  objects.push({ id: 2, value: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>` });
  objects.sort((left, right) => left.id - right.id);

  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (const object of objects) {
    offsets[object.id] = Buffer.byteLength(output, "latin1");
    output += `${object.id} 0 obj\n${object.value}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id += 1) output += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, "latin1");
}
