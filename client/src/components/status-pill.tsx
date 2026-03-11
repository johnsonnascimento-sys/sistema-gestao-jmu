import type { PreDemandaStatus } from "../types";
import { cn } from "../lib/utils";

const labels: Record<PreDemandaStatus, string> = {
  aberta: "Aberta",
  aguardando_sei: "Aguardando SEI",
  associada: "Em Andamento / Associada",
  encerrada: "Encerrada",
};

const styles: Record<PreDemandaStatus, string> = {
  aberta: "bg-amber-100 text-amber-900",
  aguardando_sei: "bg-orange-100 text-orange-900",
  associada: "bg-emerald-100 text-emerald-900",
  encerrada: "bg-slate-200 text-slate-700",
};

export function StatusPill({ status }: { status: PreDemandaStatus }) {
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", styles[status])}>{labels[status]}</span>;
}
