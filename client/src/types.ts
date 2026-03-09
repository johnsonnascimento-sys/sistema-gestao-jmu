export type UserRole = "admin" | "operador";
export type PreDemandaStatus = "aberta" | "aguardando_sei" | "associada" | "encerrada";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface SeiAssociation {
  preId: string;
  seiNumero: string;
  linkedAt: string;
  updatedAt: string;
  observacoes: string | null;
}

export interface PreDemanda {
  id: number;
  preId: string;
  solicitante: string;
  assunto: string;
  dataReferencia: string;
  status: PreDemandaStatus;
  descricao: string | null;
  fonte: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
  currentAssociation: SeiAssociation | null;
}

export interface PreDemandaAuditRecord {
  id: number;
  preId: string;
  seiNumeroAnterior: string;
  seiNumeroNovo: string;
  motivo: string | null;
  registradoEm: string;
}

export interface StatusCount {
  status: PreDemandaStatus;
  total: number;
}
