import type { PreDemandaStatus } from "../types";

const labels: Record<PreDemandaStatus, string> = {
  aberta: "Aberta",
  aguardando_sei: "Aguardando SEI",
  associada: "Associada",
  encerrada: "Encerrada",
};

export function StatusPill({ status }: { status: PreDemandaStatus }) {
  return <span className={`status-pill status-${status}`}>{labels[status]}</span>;
}
