import type { PreDemandaStatus } from "./types";

type AllowedStatusOptions = {
  currentStatus: PreDemandaStatus;
  hasAssociation: boolean;
};

const BASE_TRANSITIONS: Record<PreDemandaStatus, PreDemandaStatus[]> = {
  em_andamento: ["aguardando_sei", "encerrada"],
  aguardando_sei: ["em_andamento", "encerrada"],
  encerrada: ["em_andamento", "aguardando_sei"],
};

export function getAllowedNextStatuses({ currentStatus, hasAssociation }: AllowedStatusOptions): PreDemandaStatus[] {
  const allowed = [...BASE_TRANSITIONS[currentStatus]];

  if (hasAssociation && currentStatus === "aguardando_sei") {
    allowed.push("em_andamento");
  }

  return Array.from(new Set(allowed));
}
