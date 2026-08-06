import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskReport } from "../lib/api";
import type { TaskReportResult } from "../types";
import { getDefaultTaskReportFilters, TarefasRelatorioPage } from "./tarefas-relatorio-page";

vi.mock("../lib/api", () => ({
  getTaskReport: vi.fn(),
  formatAppError: (_error: unknown, fallback: string) => fallback,
}));

const reportResult: TaskReportResult = {
  items: [
    {
      id: "task-1",
      preId: "PRE-1",
      preNumero: "000001/2026",
      assunto: "Assunto do processo",
      descricao: "Preparar manifestação",
      tipo: "livre",
      urgente: true,
      prazoConclusao: "2026-08-10",
      horarioInicio: "09:00",
      horarioFim: "10:00",
      recorrenciaTipo: "mensal",
      setorDestinoSigla: "SEC",
      concluida: false,
      concluidaEm: null,
      createdAt: "2026-08-01T12:00:00.000Z",
    },
  ],
  summary: { total: 1, pendentes: 1, concluidas: 0, urgentes: 1, atrasadas: 0 },
  generatedAt: "2026-08-06T15:00:00.000Z",
  total: 1,
  truncated: false,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <TarefasRelatorioPage />
    </MemoryRouter>,
  );
}

describe("TarefasRelatorioPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.mocked(getTaskReport).mockReset();
    vi.mocked(getTaskReport).mockResolvedValue(reportResult);
    vi.stubGlobal("print", vi.fn());
  });

  it("carrega o recorte padrão e imprime a prévia completa", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Preparar manifestação")).toBeInTheDocument();
    expect(getTaskReport).toHaveBeenCalledWith(getDefaultTaskReportFilters());
    expect(screen.getByText("000001/2026")).toBeInTheDocument();
    expect(screen.getByText("Assunto do processo")).toBeInTheDocument();
    expect(screen.getAllByText("1", { selector: ".task-report-summary-card p:last-child" })).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /imprimir \/ salvar como pdf/i }));
    expect(window.print).toHaveBeenCalledOnce();
  });

  it("aplica filtros próprios somente ao gerar um novo relatório", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Preparar manifestação");

    await user.type(screen.getByLabelText("Pesquisa"), "  processo teste  ");
    await user.selectOptions(screen.getByLabelText("Situação"), "todas");
    await user.selectOptions(screen.getByLabelText("Urgência"), "urgentes");
    await user.selectOptions(screen.getByLabelText("Recorrência"), "mensal");
    fireEvent.change(screen.getByLabelText("Prazo inicial"), { target: { value: "2026-08-01" } });
    await user.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => expect(getTaskReport).toHaveBeenCalledTimes(2));
    expect(getTaskReport).toHaveBeenLastCalledWith({
      status: "todas",
      dueFrom: "2026-08-01",
      dueTo: getDefaultTaskReportFilters().dueTo,
      urgency: "urgentes",
      recurrence: "mensal",
      q: "processo teste",
    });
  });

  it("bloqueia a impressão quando o resultado ultrapassa 1.000 tarefas", async () => {
    vi.mocked(getTaskReport).mockResolvedValue({
      ...reportResult,
      total: 1001,
      truncated: true,
      summary: { ...reportResult.summary, total: 1001 },
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Resultado acima do limite de 1.000 tarefas");
    expect(screen.getByRole("button", { name: /imprimir \/ salvar como pdf/i })).toBeDisabled();
  });

  it("exibe os estados de erro e resultado vazio", async () => {
    vi.mocked(getTaskReport).mockRejectedValueOnce(new Error("indisponível"));
    const view = renderPage();
    expect(await screen.findByText("Não foi possível gerar o relatório")).toBeInTheDocument();

    view.unmount();
    vi.mocked(getTaskReport).mockResolvedValue({
      ...reportResult,
      items: [],
      total: 0,
      summary: { total: 0, pendentes: 0, concluidas: 0, urgentes: 0, atrasadas: 0 },
    });
    renderPage();
    expect(await screen.findByText("Nenhuma tarefa encontrada")).toBeInTheDocument();
  });
});
