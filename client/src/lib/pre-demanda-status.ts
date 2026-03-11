import type { PreDemanda, PreDemandaStatus } from "../types";

const STATUS_LABELS: Record<PreDemandaStatus, string> = {
  aberta: "Aberta",
  aguardando_sei: "Aguardando SEI",
  associada: "Em Andamento / Associada",
  encerrada: "Encerrada",
};

export function getPreDemandaStatusLabel(status: PreDemandaStatus) {
  return STATUS_LABELS[status];
}

export function getPreferredReopenStatus(item: Pick<PreDemanda, "allowedNextStatuses">): PreDemandaStatus | null {
  if (item.allowedNextStatuses.includes("associada")) {
    return "associada";
  }

  if (item.allowedNextStatuses.includes("aberta")) {
    return "aberta";
  }

  if (item.allowedNextStatuses.includes("aguardando_sei")) {
    return "aguardando_sei";
  }

  return null;
}

export function formatAllowedStatuses(statuses: PreDemandaStatus[]) {
  return statuses.map((status) => getPreDemandaStatusLabel(status)).join(", ");
}
