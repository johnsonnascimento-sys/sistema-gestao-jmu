import type { PreDemandaStatus } from "../types";
import { cn } from "../lib/utils";

const labels: Record<PreDemandaStatus, string> = {
  aberta: "Aberta",
  aguardando_sei: "Aguardando SEI",
  associada: "Em Andamento / Associada",
  encerrada: "Encerrada",
};

const styles: Record<PreDemandaStatus, string> = {
  aberta: "bg-amber-100/90 text-amber-900 ring-1 ring-amber-200/90",
  aguardando_sei: "bg-orange-100/90 text-orange-900 ring-1 ring-orange-200/90",
  associada: "bg-gradient-to-r from-sky-100 to-teal-100 text-sky-950 ring-1 ring-sky-200/90",
  encerrada: "bg-slate-200/90 text-slate-700 ring-1 ring-slate-300/80",
};

export function StatusPill({ status }: { status: PreDemandaStatus }) {
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.04)]", styles[status])}>{labels[status]}</span>;
}
