import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth-context";
import type {
  Audiencia,
  PreDemanda,
  PreDemandaStatus,
  Setor,
  TimelineEvent,
} from "../types";
import { PreDemandaDetailPage } from "./pre-demanda-detail-page";

const apiMocks = vi.hoisted(() => ({
  addPreDemandaAndamento: vi.fn(),
  addPreDemandaAssunto: vi.fn(),
  addPreDemandaInteressado: vi.fn(),
  addPreDemandaVinculo: vi.fn(),
  associateSei: vi.fn(),
  concluirTramitacaoSetor: vi.fn(),
  concluirPreDemandaTarefa: vi.fn(),
  createPessoa: vi.fn(),
  createPreDemandaAudiencia: vi.fn(),
  createPreDemandaComentario: vi.fn(),
  createPreDemandaDocumento: vi.fn(),
  createPreDemanda: vi.fn(),
  createPreDemandaTarefa: vi.fn(),
  downloadPreDemandaDocumento: vi.fn(),
  formatAppError: vi.fn((_error: unknown, fallback: string) => fallback),
  getPreDemanda: vi.fn(),
  getTimeline: vi.fn(),
  listPreDemandaAssuntos: vi.fn(),
  listPreDemandaAssuntosCatalogo: vi.fn(),
  listPreDemandaAudiencias: vi.fn(),
  listPreDemandaComentarios: vi.fn(),
  listPreDemandaDocumentos: vi.fn(),
  listPreDemandaInteressados: vi.fn(),
  listPreDemandaSeiAssociations: vi.fn(),
  listPreDemandaSetoresAtivos: vi.fn(),
  listPreDemandaTaskScheduleSuggestions: vi.fn(),
  listPreDemandaTarefas: vi.fn(),
  listPreDemandaVinculos: vi.fn(),
  listPessoas: vi.fn(),
  listPreDemandas: vi.fn(),
  listSetores: vi.fn(),
  removePreDemandaAndamento: vi.fn(),
  removePreDemandaAssunto: vi.fn(),
  removePreDemandaAudiencia: vi.fn(),
  removePreDemandaDocumento: vi.fn(),
  removePreDemandaInteressado: vi.fn(),
  removePreDemandaTarefa: vi.fn(),
  removePreDemandaVinculo: vi.fn(),
  reorderPreDemandaTarefas: vi.fn(),
  tramitarPreDemandaMultiplos: vi.fn(),
  updatePreDemandaAnotacoes: vi.fn(),
  updatePreDemandaAndamento: vi.fn(),
  updatePreDemandaAudiencia: vi.fn(),
  updatePreDemandaCase: vi.fn(),
  updatePreDemandaStatus: vi.fn(),
  updatePreDemandaTarefa: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

vi.mock("./pre-demanda-detail-dialogs", () => ({
  AndamentoCreateDialog: () => null,
  AndamentoDeleteDialog: () => null,
  AndamentoEditDialog: () => null,
  TarefaDeleteDialog: () => null,
  TarefaPrazoChangeDialog: () => null,
  TarefasDialog: () => null,
}));

function buildAudiencia(situacao: Audiencia["situacao"]): Audiencia {
  return {
    id: "aud-1",
    preId: "PRE-2026-001",
    dataHoraInicio: "2026-04-29T10:00:00.000Z",
    dataHoraFim: "2026-04-29T11:00:00.000Z",
    descricao: "Audiencia principal",
    sala: "Sala 1",
    situacao,
    observacoes: null,
    createdAt: "2026-04-29T09:00:00.000Z",
    updatedAt: "2026-04-29T09:00:00.000Z",
    createdBy: null,
    updatedBy: null,
  };
}

function buildRecord(audienciaStatus: PreDemandaStatus): PreDemanda {
  const queueHealth = {
    level: "fresh",
    staleDays: 0,
    ageDays: 1,
    attentionDays: 3,
    criticalDays: 7,
  } as PreDemanda["queueHealth"];

  const setor = {
    id: "setor-1",
    sigla: "SEC",
    nomeCompleto: "Secretaria",
    createdAt: "2026-04-29T09:00:00.000Z",
    updatedAt: "2026-04-29T09:00:00.000Z",
  } as Setor;

  return {
    id: 1,
    preId: "PRE-2026-001",
    solicitante: "Joao da Silva",
    pessoaPrincipal: null,
    principalNumero: "12345-67.2026.1.01.0001",
    principalTipo: "demanda",
    assunto: "Audiencia de teste",
    dataReferencia: "2026-04-29",
    status: "em_andamento",
    descricao: "Processo de teste",
    fonte: null,
    observacoes: null,
    prazoProcesso: "2026-05-10",
    proximoPrazoTarefa: null,
    prazoStatus: "no_prazo",
    prazoInicial: null,
    prazoIntermediario: null,
    prazoFinal: null,
    dataConclusao: null,
    numeroJudicial: "0001234-56.2026.4.01.3400",
    anotacoes: null,
    setorAtual: setor,
    metadata: {
      frequencia: null,
      frequenciaDiasSemana: null,
      frequenciaDiaMes: null,
      pagamentoEnvolvido: false,
      urgente: false,
      urgenteManual: false,
      audienciaData: "2026-04-29",
      audienciaStatus,
      audienciaHorarioInicio: "2026-04-29T10:00:00.000Z",
      audienciaHorarioFim: "2026-04-29T11:00:00.000Z",
      audienciaSala: "Sala 1",
      audienciaDescricao: "Audiencia principal",
      reaberturaProgramada: null,
      reaberturaProgramadaData: null,
      reaberturaProgramadaMotivo: null,
      reaberturaProgramadaModo: null,
      reaberturaProgramadaDias: null,
      reaberturaProgramadaStatus: null,
    } as PreDemanda["metadata"],
    createdAt: "2026-04-29T09:00:00.000Z",
    updatedAt: "2026-04-29T09:00:00.000Z",
    createdBy: null,
    currentAssociation: null,
    assuntos: [],
    seiAssociations: [],
    numerosJudiciais: [],
    queueHealth,
    allowedNextStatuses: ["encerrada"],
    interessados: [],
    vinculos: [],
    setoresAtivos: [],
    documentos: [],
    comentarios: [],
    tarefasPendentes: [],
    recentAndamentos: [],
    audiencias: [buildAudiencia(audienciaStatus)],
  };
}

function renderPage() {
  render(
    <AuthContext.Provider
      value={{
        user: {
          id: 1,
          email: "admin@jmu.local",
          name: "Admin",
          role: "admin",
          permissions: [
            "dashboard.read",
            "pre_demanda.read",
            "pre_demanda.update",
            "pre_demanda.update_status",
            "pre_demanda.manage_audiencias",
          ],
        },
        status: "authenticated",
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        hasPermission: vi.fn().mockReturnValue(true),
      }}
    >
      <MemoryRouter initialEntries={["/pre-demandas/PRE-2026-001"]}>
        <Routes>
          <Route element={<PreDemandaDetailPage />} path="/pre-demandas/:preId" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("PreDemandaDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    apiMocks.getPreDemanda
      .mockResolvedValueOnce(buildRecord("designada"))
      .mockResolvedValueOnce(buildRecord("realizada"))
      .mockResolvedValue(buildRecord("realizada"));
    apiMocks.getTimeline.mockResolvedValue([]);
    apiMocks.listSetores.mockResolvedValue([]);
    apiMocks.listPreDemandaTarefas.mockResolvedValue([]);
    apiMocks.listPreDemandaAudiencias
      .mockResolvedValueOnce([buildAudiencia("designada")])
      .mockResolvedValue([buildAudiencia("realizada")]);
    apiMocks.listPreDemandaAssuntos.mockResolvedValue([]);
    apiMocks.listPreDemandaAssuntosCatalogo.mockResolvedValue([]);
    apiMocks.listPreDemandaComentarios.mockResolvedValue([]);
    apiMocks.listPreDemandaDocumentos.mockResolvedValue([]);
    apiMocks.listPreDemandaInteressados.mockResolvedValue([]);
    apiMocks.listPreDemandaSeiAssociations.mockResolvedValue([]);
    apiMocks.listPreDemandaSetoresAtivos.mockResolvedValue([]);
    apiMocks.listPreDemandaTaskScheduleSuggestions.mockResolvedValue([]);
    apiMocks.listPreDemandaVinculos.mockResolvedValue([]);
    apiMocks.listPessoas.mockResolvedValue({ items: [], total: 0 });
    apiMocks.listPreDemandas.mockResolvedValue({ items: [], total: 0 });
    apiMocks.updatePreDemandaAudiencia.mockResolvedValue(buildAudiencia("realizada"));
  });

  it("habilita concluir sem recarregar a pagina ao salvar audiencia como realizada", async () => {
    const user = userEvent.setup();

    renderPage();

    const concluirButton = await screen.findByRole("button", { name: "Concluir" });
    expect(concluirButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Audiencias" }));

    const audienciaDialog = await screen.findByRole("dialog", {
      name: /audiencias judiciais/i,
    });
    const dialog = within(audienciaDialog);

    await user.click(dialog.getByRole("button", { name: "Editar" }));
    await user.selectOptions(dialog.getByLabelText("Situacao"), "realizada");
    await user.click(dialog.getByRole("button", { name: "Salvar alteracao" }));

    await waitFor(() => {
      expect(concluirButton).toBeEnabled();
    });

    expect(apiMocks.updatePreDemandaAudiencia).toHaveBeenCalledWith(
      "PRE-2026-001",
      "aud-1",
      expect.objectContaining({
        situacao: "realizada",
      }),
    );
  });
});
