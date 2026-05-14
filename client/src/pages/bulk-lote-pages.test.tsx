import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth-context";
import type { BulkAndamentoResult, BulkTarefaResult, PreDemanda } from "../types";
import { AndamentosLotePage } from "./andamentos-lote-page";
import { TarefasLotePage } from "./tarefas-lote-page";

const apiMocks = vi.hoisted(() => ({
  addPreDemandaAndamentosLote: vi.fn(),
  createPreDemandaTarefasLote: vi.fn(),
  formatAppError: vi.fn((_error: unknown, fallback: string) => fallback),
  listPreDemandas: vi.fn(),
  listSetores: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

function buildPreDemanda(preId: string, assunto: string): PreDemanda {
  return {
    id: Number(preId.replace(/\D/g, "")) || 1,
    preId,
    solicitante: "Joao da Silva",
    pessoaPrincipal: null,
    principalNumero: `${preId}-NUMERO`,
    principalTipo: "demanda",
    assunto,
    dataReferencia: "2026-05-14",
    status: "em_andamento",
    descricao: "Descricao de teste",
    fonte: null,
    observacoes: null,
    prazoProcesso: "2026-05-20",
    proximoPrazoTarefa: null,
    prazoStatus: "no_prazo",
    prazoInicial: null,
    prazoIntermediario: null,
    prazoFinal: null,
    dataConclusao: null,
    numeroJudicial: null,
    anotacoes: null,
    setorAtual: null,
    metadata: null,
    createdAt: "2026-05-14T12:00:00.000Z",
    updatedAt: "2026-05-14T12:00:00.000Z",
    createdBy: null,
    currentAssociation: null,
    assuntos: [],
    seiAssociations: [],
    numerosJudiciais: [],
    queueHealth: {
      level: "fresh",
      staleDays: 0,
      ageDays: 1,
      attentionDays: 3,
      criticalDays: 7,
    },
    allowedNextStatuses: ["em_andamento"],
    interessados: [],
    vinculos: [],
    setoresAtivos: [],
    documentos: [],
    comentarios: [],
    tarefasPendentes: [],
    recentAndamentos: [],
    audiencias: [],
  } as PreDemanda;
}

function renderWithAuth(ui: ReactElement) {
  render(
    <AuthContext.Provider
      value={{
        user: {
          id: 1,
          email: "admin@jmu.local",
          name: "Admin",
          role: "admin",
          permissions: ["pre_demanda.read", "pre_demanda.update", "pre_demanda.manage_tarefas"],
        },
        status: "authenticated",
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        hasPermission: vi.fn().mockReturnValue(true),
      }}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function selectTwoProcesses() {
  const user = userEvent.setup();
  const search = screen.getByPlaceholderText("PROCESSO, SEI, pessoa ou assunto");
  await user.type(search, "lote");
  expect(await screen.findByText("Processo A")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Selecionar resultados" }));
  expect(screen.getByText("2 selecionado(s)")).toBeInTheDocument();
  return user;
}

beforeEach(() => {
  apiMocks.listPreDemandas.mockResolvedValue({
    items: [buildPreDemanda("PRE-1", "Processo A"), buildPreDemanda("PRE-2", "Processo B")],
    total: 2,
    page: 1,
    pageSize: 8,
    counts: [],
  });
  apiMocks.listSetores.mockResolvedValue([]);
  apiMocks.formatAppError.mockImplementation((_error: unknown, fallback: string) => fallback);
  apiMocks.addPreDemandaAndamentosLote.mockReset();
  apiMocks.createPreDemandaTarefasLote.mockReset();
  apiMocks.listPreDemandas.mockClear();
  apiMocks.listSetores.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("AndamentosLotePage", () => {
  it("mantem a selecao apos sucesso total", async () => {
    apiMocks.addPreDemandaAndamentosLote.mockResolvedValue({
      total: 2,
      successCount: 2,
      failureCount: 0,
      results: [
        { preId: "PRE-1", ok: true, message: "Andamento registrado." },
        { preId: "PRE-2", ok: true, message: "Andamento registrado." },
      ],
    } satisfies BulkAndamentoResult);

    renderWithAuth(<AndamentosLotePage />);
    const user = await selectTwoProcesses();
    await user.type(screen.getByLabelText("Descricao"), "Andamento em lote");
    fireEvent.change(screen.getByLabelText("Data e hora"), { target: { value: "2026-05-14T10:30" } });
    await user.click(screen.getByRole("button", { name: "Lancar andamento em lote" }));

    expect(await screen.findByText(/Resultado do/i)).toBeInTheDocument();
    expect(screen.getByText("2 selecionado(s)")).toBeInTheDocument();
  });

  it("mantem a selecao apos falha parcial", async () => {
    apiMocks.addPreDemandaAndamentosLote.mockResolvedValue({
      total: 2,
      successCount: 1,
      failureCount: 1,
      results: [
        { preId: "PRE-1", ok: true, message: "Andamento registrado." },
        { preId: "PRE-2", ok: false, message: "Falha ao registrar andamento." },
      ],
    } satisfies BulkAndamentoResult);

    renderWithAuth(<AndamentosLotePage />);
    const user = await selectTwoProcesses();
    await user.type(screen.getByLabelText("Descricao"), "Andamento em lote");
    await user.click(screen.getByRole("button", { name: "Lancar andamento em lote" }));

    expect(await screen.findByText(/Resultado do/i)).toBeInTheDocument();
    expect(screen.getByText("2 selecionado(s)")).toBeInTheDocument();
  });
});

describe("TarefasLotePage", () => {
  it("mantem a selecao apos sucesso total", async () => {
    apiMocks.createPreDemandaTarefasLote.mockResolvedValue({
      total: 2,
      successCount: 2,
      failureCount: 0,
      results: [
        { preId: "PRE-1", ok: true, message: "Tarefa registrada." },
        { preId: "PRE-2", ok: true, message: "Tarefa registrada." },
      ],
    } satisfies BulkTarefaResult);

    renderWithAuth(<TarefasLotePage />);
    const user = await selectTwoProcesses();
    await user.type(screen.getByLabelText("Descricao"), "Tarefa em lote");
    fireEvent.change(screen.getByLabelText("Prazo da tarefa"), { target: { value: "2026-05-20" } });
    await user.click(screen.getByRole("button", { name: "Lancar tarefa em lote" }));

    expect(await screen.findByText(/Resultado do/i)).toBeInTheDocument();
    expect(screen.getByText("2 selecionado(s)")).toBeInTheDocument();
  });

  it("mantem a selecao apos falha parcial", async () => {
    apiMocks.createPreDemandaTarefasLote.mockResolvedValue({
      total: 2,
      successCount: 1,
      failureCount: 1,
      results: [
        { preId: "PRE-1", ok: true, message: "Tarefa registrada." },
        { preId: "PRE-2", ok: false, message: "Falha ao registrar tarefa." },
      ],
    } satisfies BulkTarefaResult);

    renderWithAuth(<TarefasLotePage />);
    const user = await selectTwoProcesses();
    await user.type(screen.getByLabelText("Descricao"), "Tarefa em lote");
    fireEvent.change(screen.getByLabelText("Prazo da tarefa"), { target: { value: "2026-05-20" } });
    await user.click(screen.getByRole("button", { name: "Lancar tarefa em lote" }));

    expect(await screen.findByText(/Resultado do/i)).toBeInTheDocument();
    expect(screen.getByText("2 selecionado(s)")).toBeInTheDocument();
  });
});
