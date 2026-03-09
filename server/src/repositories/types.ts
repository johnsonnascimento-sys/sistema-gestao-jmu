import type {
  AppUser,
  PreDemandaAuditRecord,
  PreDemandaDetail,
  PreDemandaStatus,
  SeiAssociation,
} from "../domain/types";

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "operador";
}

export interface CreatePreDemandaInput {
  solicitante: string;
  assunto: string;
  dataReferencia: string;
  descricao?: string | null;
  fonte?: string | null;
  observacoes?: string | null;
}

export interface CreatePreDemandaResult {
  record: PreDemandaDetail;
  idempotent: boolean;
}

export interface AssociateSeiInput {
  preId: string;
  seiNumero: string;
  motivo?: string | null;
  observacoes?: string | null;
}

export interface AssociateSeiResult {
  association: SeiAssociation;
  audited: boolean;
}

export interface ListPreDemandasParams {
  q?: string;
  statuses?: PreDemandaStatus[];
  page: number;
  pageSize: number;
}

export interface ListPreDemandasResult {
  items: PreDemandaDetail[];
  total: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<AppUser | null>;
  findById(id: number): Promise<AppUser | null>;
  create(input: CreateUserInput): Promise<AppUser>;
}

export interface PreDemandaRepository {
  create(input: CreatePreDemandaInput): Promise<CreatePreDemandaResult>;
  list(params: ListPreDemandasParams): Promise<ListPreDemandasResult>;
  getStatusCounts(): Promise<Array<{ status: PreDemandaStatus; total: number }>>;
  getByPreId(preId: string): Promise<PreDemandaDetail | null>;
  associateSei(input: AssociateSeiInput): Promise<AssociateSeiResult>;
  listAudit(preId: string): Promise<PreDemandaAuditRecord[]>;
}
