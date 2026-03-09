export type UserRole = "admin" | "operador";

export interface AppUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export type PreDemandaStatus = "aberta" | "aguardando_sei" | "associada" | "encerrada";

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
}

export interface SeiAssociation {
  preId: string;
  seiNumero: string;
  linkedAt: string;
  updatedAt: string;
  observacoes: string | null;
}

export interface PreDemandaDetail extends PreDemanda {
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
