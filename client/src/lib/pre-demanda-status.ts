import type { PreDemanda, PreDemandaStatus } from "../types";

const STATUS_LABELS: Record<PreDemandaStatus, string> = {
  em_andamento: "Em andamento",
  aguardando_sei: "Aguardando SEI",
  encerrada: "Encerrado",
};

export function getPreDemandaStatusLabel(status: PreDemandaStatus) {
  return STATUS_LABELS[status];
}

export function getPreferredReopenStatus(item: Pick<PreDemanda, "allowedNextStatuses">): PreDemandaStatus | null {
  if (item.allowedNextStatuses.includes("em_andamento")) {
    return "em_andamento";
  }

  if (item.allowedNextStatuses.includes("aguardando_sei")) {
    return "aguardando_sei";
  }

  return null;
}

export function formatAllowedStatuses(statuses: PreDemandaStatus[]) {
  return statuses.map((status) => getPreDemandaStatusLabel(status)).join(", ");
}
