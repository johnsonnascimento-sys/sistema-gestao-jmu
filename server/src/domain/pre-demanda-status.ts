import type { PreDemandaStatus } from "./types";

type AllowedStatusOptions = {
  currentStatus: PreDemandaStatus;
  hasAssociation: boolean;
};

const BASE_TRANSITIONS: Record<PreDemandaStatus, PreDemandaStatus[]> = {
  aberta: ["aguardando_sei", "encerrada"],
  aguardando_sei: ["aberta", "encerrada"],
  associada: ["encerrada"],
  encerrada: ["aberta", "aguardando_sei"],
};

export function getAllowedNextStatuses({ currentStatus, hasAssociation }: AllowedStatusOptions): PreDemandaStatus[] {
  const allowed = [...BASE_TRANSITIONS[currentStatus]];

  if (hasAssociation && currentStatus !== "associada") {
    allowed.push("associada");
  }

  return Array.from(new Set(allowed));
}
