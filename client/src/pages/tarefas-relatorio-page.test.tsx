import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskReport } from "../lib/api";
import type { TaskReportItem, TaskReportResult } from "../types";
import { getDefaultTaskReportFilters, TarefasRelatorioPage } from "./tarefas-relatorio-page";

vi.mock("../lib/api", () => ({
  getTaskReport: vi.fn(),
  formatAppError: (_error: unknown, fallback: string) => fallback,
}));

const baseReportItem: TaskReportItem = {
  id: "task-1",
  preId: "PRE-1",
  preNumero: "000001/2026",
  assunto: "Assunto do processo",
  processoUrgente: false,
  hasAudiencia: false,
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
};

const reportResult: TaskReportResult = {
  items: [baseReportItem],
  summary: { total: 1, pendentes: 1, concluidas: 0, urgentes: 1, atrasadas: 0 },
  generatedAt: "2026-08-06T15:00:00.000Z",
  total: 1,
  truncated: false,
};

const groupedReportResult: TaskReportResult = {
  ...reportResult,
  items: [
    {
      ...baseReportItem,
      processoUrgente: true,
      hasAudiencia: true,
    },
    {
      ...baseReportItem,
      id: "task-2",
      processoUrgente: true,
      hasAudiencia: false,
      descricao: "Revisar manifestação",
      prazoConclusao: "2026-08-11",
    },
    {
      ...baseReportItem,
      id: "task-3",
      preId: "PRE-2",
      preNumero: "000002/2026",
      assunto: "Outro assunto",
      processoUrgente: false,
      descricao: "Encaminhar resposta",
      urgente: false,
      prazoConclusao: "2026-08-12",
    },
  ],
  summary: { total: 3, pendentes: 3, concluidas: 0, urgentes: 2, atrasadas: 0 },
  total: 3,
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
    const hearingSection = screen.getByRole("region", { name: "Processos com audiência designada" });
    const otherSection = screen.getByRole("region", { name: "Demais processos" });
    expect(within(hearingSection).getByText("0 processos · 0 tarefas")).toBeInTheDocument();
    expect(within(hearingSection).getByText("Nenhuma tarefa nesta seção.")).toBeInTheDocument();
    expect(within(otherSection).getByText("1 processo · 1 tarefa")).toBeInTheDocument();

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

  it("unifica tarefas por processo somente ao gerar e restaura a exibição padrão", async () => {
    vi.mocked(getTaskReport).mockResolvedValue(groupedReportResult);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Revisar manifestação");
    const unifyCheckbox = screen.getByRole("checkbox", { name: /unificar por processo\/demanda/i });
    const appliedFilters = () => screen.getByText("Filtros aplicados:").closest("p");
    expect(unifyCheckbox).not.toBeChecked();
    expect(screen.getAllByText("000001/2026")).toHaveLength(2);
    expect(screen.getAllByText("Processo urgente")).toHaveLength(2);
    expect(screen.getAllByText("Audiência designada")).toHaveLength(2);
    expect(appliedFilters()).not.toHaveTextContent("Unificado por processo/demanda");

    await user.click(unifyCheckbox);
    expect(screen.getAllByText("000001/2026")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Gerar relatório" }));

    await waitFor(() => expect(getTaskReport).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText("000001/2026")).toHaveLength(1));
    expect(screen.getAllByText("Processo urgente")).toHaveLength(1);
    expect(screen.getAllByText("Audiência designada")).toHaveLength(1);
    expect(appliedFilters()).toHaveTextContent("Unificado por processo/demanda");
    expect(screen.getByText("Preparar manifestação")).toBeInTheDocument();
    expect(screen.getByText("Revisar manifestação")).toBeInTheDocument();
    expect(screen.getByText("Encaminhar resposta")).toBeInTheDocument();
    expect(screen.getByText("000001/2026").closest("td")).toHaveAttribute("rowspan", "2");
    expect(screen.getByText("000001/2026").closest("tbody")).toHaveClass("task-report-process-urgent");
    expect(screen.getByText("000001/2026").closest("tbody")).toHaveClass("task-report-process-hearing");
    expect(getTaskReport).toHaveBeenLastCalledWith(getDefaultTaskReportFilters());

    await user.click(screen.getByRole("button", { name: /imprimir \/ salvar como pdf/i }));
    expect(window.print).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Restaurar padrão" }));

    await waitFor(() => expect(getTaskReport).toHaveBeenCalledTimes(3));
    expect(unifyCheckbox).not.toBeChecked();
    await waitFor(() => expect(screen.getAllByText("000001/2026")).toHaveLength(2));
    expect(appliedFilters()).not.toHaveTextContent("Unificado por processo/demanda");
  });

  it("separa processos com audiência, preserva a ordem e repete cabeçalhos nas duas seções", async () => {
    vi.mocked(getTaskReport).mockResolvedValue(groupedReportResult);
    renderPage();

    const hearingSection = await screen.findByRole("region", { name: "Processos com audiência designada" });
    const otherSection = screen.getByRole("region", { name: "Demais processos" });
    const hearingText = hearingSection.textContent ?? "";

    expect(within(hearingSection).getByText("1 processo · 2 tarefas")).toBeInTheDocument();
    expect(within(otherSection).getByText("1 processo · 1 tarefa")).toBeInTheDocument();
    expect(hearingText.indexOf("Preparar manifestação"))
      .toBeLessThan(hearingText.indexOf("Revisar manifestação"));
    expect(within(hearingSection).getAllByText("Audiência designada")).toHaveLength(2);
    expect(within(otherSection).queryByText("Audiência designada")).not.toBeInTheDocument();
    expect(within(hearingSection).getAllByText("000001/2026")[0]!.closest("tbody"))
      .toHaveClass("task-report-process-urgent", "task-report-process-hearing");
    expect(hearingSection.querySelectorAll("thead")).toHaveLength(1);
    expect(otherSection.querySelectorAll("thead")).toHaveLength(1);
    expect(hearingSection.querySelector(".task-report-section-header")).toBeInTheDocument();
  });

  it("não confunde a urgência da tarefa com a urgência do processo", async () => {
    renderPage();

    expect(await screen.findByText("Preparar manifestação")).toBeInTheDocument();
    expect(screen.getByText("Urgente", { selector: "td" })).toBeInTheDocument();
    expect(screen.queryByText("Processo urgente")).not.toBeInTheDocument();
    expect(screen.getByText("000001/2026").closest("tbody")).not.toHaveClass("task-report-process-urgent");
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
    expect(screen.getByRole("region", { name: "Processos com audiência designada" })).toHaveTextContent("Nenhuma tarefa nesta seção.");
    expect(screen.getByRole("region", { name: "Demais processos" })).toHaveTextContent("Nenhuma tarefa nesta seção.");
  });
});
