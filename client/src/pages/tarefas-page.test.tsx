import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAudienciasPauta, listDashboardTasks } from "../lib/api";
import { TarefasPage } from "./tarefas-page";

vi.mock("../lib/api", () => ({
  listDashboardTasks: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    counts: { pendentes: 0, concluidas: 0 },
    openProcessesWithoutTasks: { total: 0, items: [] },
    urgentProcesses: { total: 0, items: [] },
  }),
  getAudienciasPauta: vi.fn().mockResolvedValue([]),
  formatAppError: (_error: unknown, fallback: string) => fallback,
}));

describe("TarefasPage", () => {
  afterEach(() => cleanup());

  it("abre o relatório dedicado pelo botão do cabeçalho", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/tarefas"]}>
        <Routes>
          <Route element={<TarefasPage />} path="/tarefas" />
          <Route element={<h1>Relatório dedicado</h1>} path="/tarefas/relatorio" />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: "Relatório" })).toBeInTheDocument();
    expect(listDashboardTasks).toHaveBeenCalled();
    await user.click(screen.getByRole("link", { name: "Relatório" }));
    expect(screen.getByRole("heading", { name: "Relatório dedicado" })).toBeInTheDocument();
  });

  it("exibe audiência designada mesmo sem tarefa pendente", async () => {
    vi.mocked(getAudienciasPauta).mockResolvedValueOnce([
      {
        id: "aud-7000236",
        preId: "pre-7000236",
        preNumero: "7000236-03.2025.7.02.0002",
        numeroJudicial: "7000236-03.2025.7.02.0002",
        assunto: "Audiência sem tarefa",
        magistradoNome: null,
        descricao: "Audiência de instrução",
        dataHoraInicio: "2026-08-20T13:00:00.000Z",
        dataHoraFim: null,
        observacoes: null,
        situacao: "designada",
        tarefasPendentes: [],
      },
    ]);

    render(
      <MemoryRouter>
        <TarefasPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("7000236-03.2025.7.02.0002")).toBeInTheDocument();
    expect(screen.getByText("Sem tarefas pendentes")).toBeInTheDocument();
    expect(screen.getByText("Audiência sem tarefa")).toBeInTheDocument();
  });

  it("pagina por processo ao unificar para manter juntas todas as tarefas dele", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TarefasPage /></MemoryRouter>);

    await screen.findByText("Fila geral de tarefas");
    await user.click(screen.getByRole("checkbox", { name: "Unificar tarefas por processo" }));

    expect(listDashboardTasks).toHaveBeenLastCalledWith(expect.objectContaining({
      groupByProcess: true,
      page: 1,
      pageSize: 20,
    }));
  });

  it("mantem a pendencia de audiencia somente no cartao do processo", async () => {
    vi.mocked(listDashboardTasks).mockResolvedValueOnce({
      items: [
        {
          id: "task-audiencia", preId: "pre-audiencia", preNumero: "7000236-03.2025.7.02.0002",
          assunto: "Processo com audiencia", descricao: "Preparar audiencia", tipo: "livre",
          urgente: false, prazoConclusao: "2026-08-20", horarioInicio: null, horarioFim: null,
          recorrenciaTipo: null, setorDestinoSigla: null, hasAudiencia: true,
          geradaAutomaticamente: false, concluida: false, concluidaEm: null, createdAt: "2026-08-18T10:00:00.000Z",
        },
        {
          id: "task-geral", preId: "pre-geral", preNumero: "PRE-001",
          assunto: "Processo geral", descricao: "Tarefa geral", tipo: "livre",
          urgente: false, prazoConclusao: "2026-08-21", horarioInicio: null, horarioFim: null,
          recorrenciaTipo: null, setorDestinoSigla: null, hasAudiencia: false,
          geradaAutomaticamente: false, concluida: false, concluidaEm: null, createdAt: "2026-08-18T10:00:00.000Z",
        },
      ], total: 2, page: 1, pageSize: 20, counts: { pendentes: 2, concluidas: 0 },
      openProcessesWithoutTasks: { total: 0, items: [] }, urgentProcesses: { total: 0, items: [] },
    });
    vi.mocked(getAudienciasPauta).mockResolvedValueOnce([{
      id: "aud-7000236", preId: "pre-audiencia", preNumero: "7000236-03.2025.7.02.0002",
      numeroJudicial: "7000236-03.2025.7.02.0002", assunto: "Processo com audiencia",
      magistradoNome: null, descricao: null, dataHoraInicio: "2026-08-20T13:00:00.000Z",
      dataHoraFim: null, observacoes: null, situacao: "designada",
      tarefasPendentes: [{
        id: "task-audiencia", descricao: "Preparar audiencia", tipo: "livre", urgente: false,
        prazoConclusao: "2026-08-20", horarioInicio: null, horarioFim: null,
      }],
    }]);

    render(<MemoryRouter><TarefasPage /></MemoryRouter>);

    expect(await screen.findByText("Tarefa geral")).toBeInTheDocument();
    expect(screen.getAllByText("Preparar audiencia")).toHaveLength(1);
  });
});
