import type { PreDemandaStatus, TarefaPendente, TarefaRecorrenciaTipo } from "../types";
import { getDeadlineSignal } from "../lib/deadline-signal";

// ── Dialog / State types ─────────────────────────────────────────────────────

export type ToolbarDialog =
  | null
  | "related"
  | "edit"
  | "send"
  | "link"
  | "notes"
  | "deadline"
  | "tasks"
  | "andamento"
  | "summary"
  | "people"
  | "sectors"
  | "operational"
  | "relatedList"
  | "seiAssociation"
  | "documents"
  | "comments";

export type StatusAction = {
  nextStatus: PreDemandaStatus;
  title: string;
  requireReason: boolean;
};

export type TaskPrazoChangeState = {
  mode: "create" | "edit";
  payload: {
    descricao: string;
    tipo: "fixa" | "livre";
    prazo_conclusao: string;
    recorrencia_tipo?: TarefaRecorrenciaTipo | null;
    recorrencia_dias_semana?: string[] | null;
    recorrencia_dia_mes?: number | null;
    setor_destino_id?: string | null;
  };
  details: {
    prazoLabel?: string | null;
    prazoDataAnterior?: string | null;
    prazoDataNova?: string | null;
  };
};

export type TaskSignal = "atrasado" | "no_prazo";

// ── Constants ────────────────────────────────────────────────────────────────

export const FIXED_TASKS = [
  "Assinatura de pessoa",
  "Definicao de audiencia",
  "Envio para",
  "Retorno do setor",
];

export const WEEKDAY_OPTIONS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"] as const;

export const selectClassName =
  "h-11 w-full rounded-2xl border border-sky-100/90 bg-white/95 px-4 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-sky-200/55";

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function formatRecorrenciaLabel(
  task: Pick<TarefaPendente, "recorrenciaTipo" | "recorrenciaDiasSemana" | "recorrenciaDiaMes">,
) {
  if (!task.recorrenciaTipo) return null;
  if (task.recorrenciaTipo === "diaria") return "Recorrente diaria";
  if (task.recorrenciaTipo === "semanal") {
    return task.recorrenciaDiasSemana?.length
      ? `Recorrente semanal (${task.recorrenciaDiasSemana.join(", ")})`
      : "Recorrente semanal";
  }
  return task.recorrenciaDiaMes
    ? `Recorrente mensal (dia ${task.recorrenciaDiaMes})`
    : "Recorrente mensal";
}

export function getTaskSignal(prazoConclusao: string | null | undefined): TaskSignal | null {
  return getDeadlineSignal(prazoConclusao);
}

export function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function toIsoFromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler o ficheiro."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Falha ao ler o ficheiro."));
    reader.readAsDataURL(file);
  });
}
