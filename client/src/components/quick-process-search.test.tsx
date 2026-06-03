import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickProcessSearch } from "./quick-process-search";

const apiMocks = vi.hoisted(() => ({
  listPessoas: vi.fn(),
  listPreDemandas: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("QuickProcessSearch", () => {
  it("navega para a lista filtrada por pessoa selecionada", async () => {
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

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <QuickProcessSearch />
                <LocationEcho />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Buscar pessoa especifica"), "Maria");
    const result = await screen.findByText("Maria Assinante");
    await user.click(result.closest("button")!);
    await user.click(screen.getByRole("button", { name: "Filtrar" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/pre-demandas?pessoaId=11111111-1111-1111-1111-111111111111&pessoaNome=Maria+Assinante&view=table&page=1",
      );
    });
  });

  it("limpa apenas a pessoa selecionada sem apagar a busca principal", async () => {
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

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <QuickProcessSearch />
                <LocationEcho />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Buscar processo rapido"), "sei-123");
    await user.type(screen.getByLabelText("Buscar pessoa especifica"), "Maria");
    const result = await screen.findByText("Maria Assinante");
    await user.click(result.closest("button")!);
    await user.click(screen.getByRole("button", { name: "Limpar pessoa" }));

    expect(screen.getByLabelText("Buscar processo rapido")).toHaveValue("sei-123");
    expect(screen.getByLabelText("Buscar pessoa especifica")).toHaveValue("");
    expect(screen.queryByText("Maria Assinante")).not.toBeInTheDocument();
  });
});
