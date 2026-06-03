import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreDemandasFilters } from "./pre-demandas-filters";
import type { ResolvedSearchState } from "./pre-demandas-utils";

const apiMocks = vi.hoisted(() => ({
  listPessoas: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

const resolvedState: ResolvedSearchState = {
  presetId: null,
  q: "",
  statuses: [],
  queueHealth: [],
  dateFrom: "",
  dateTo: "",
  pessoaId: "",
  pessoaNome: "",
  hasSei: "",
  setorAtualId: "",
  withoutSetor: "",
  dueState: "",
  deadlineCampo: "",
  prazoRecorte: "",
  taskRecurrence: "",
  paymentInvolved: "",
  hasInteressados: "",
  closedWithinDays: "",
  reopenedWithinDays: "",
  sortBy: "updatedAt",
  sortOrder: "desc",
  page: 1,
  view: "table",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("PreDemandasFilters", () => {
  it("inclui a pessoa selecionada na query da listagem", async () => {
    apiMocks.listPessoas.mockResolvedValue({
      items: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          nome: "Maria Assinante",
          cargo: "Analista",
          matricula: "123",
          cpf: null,
          rg: null,
          pai: null,
          mae: null,
          endereco: null,
          dataNascimento: null,
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
    });

    const setSearchParams = vi.fn();

    render(
      <PreDemandasFilters
        resolvedState={resolvedState}
        searchParams={new URLSearchParams()}
        setores={[]}
        setSearchParams={setSearchParams}
      />,
    );

    const user = userEvent.setup();
    await user.type(screen.getAllByLabelText("Buscar pessoa nos filtros")[0], "Maria");
    const result = await screen.findByText("Maria Assinante");
    await user.click(result.closest("button")!);
    await user.click(screen.getAllByRole("button", { name: "Aplicar" })[0]);

    await waitFor(() => {
      expect(setSearchParams).toHaveBeenCalledTimes(1);
    });

    const nextParams = setSearchParams.mock.calls[0][0] as URLSearchParams;
    expect(nextParams.toString()).toBe(
      "pessoaId=11111111-1111-1111-1111-111111111111&pessoaNome=Maria+Assinante&sortBy=updatedAt&sortOrder=desc&view=table&page=1",
    );
  });

  it("permite limpar somente a pessoa sem alterar os demais filtros", async () => {
    apiMocks.listPessoas.mockResolvedValue({
      items: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          nome: "Maria Assinante",
          cargo: "Analista",
          matricula: "123",
          cpf: null,
          rg: null,
          pai: null,
          mae: null,
          endereco: null,
          dataNascimento: null,
          createdAt: "2026-06-03T12:00:00.000Z",
          updatedAt: "2026-06-03T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
    });

    const setSearchParams = vi.fn();

    render(
      <PreDemandasFilters
        resolvedState={{
          ...resolvedState,
          q: "sei-123",
          statuses: ["em_andamento"],
        }}
        searchParams={new URLSearchParams("q=sei-123&status=em_andamento")}
        setores={[]}
        setSearchParams={setSearchParams}
      />,
    );

    const user = userEvent.setup();
    await user.type(screen.getAllByLabelText("Buscar pessoa nos filtros")[0], "Maria");
    const result = await screen.findByText("Maria Assinante");
    await user.click(result.closest("button")!);
    await user.click(screen.getByRole("button", { name: "Limpar pessoa" }));
    expect(screen.getAllByLabelText("Buscar pessoa nos filtros")[0]).toHaveValue("");
    expect(screen.getByDisplayValue("sei-123")).toBeInTheDocument();
    expect(screen.queryByText("Limpar pessoa")).not.toBeInTheDocument();
  });
});
