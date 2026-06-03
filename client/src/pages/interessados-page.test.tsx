import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth-context";
import type { Interessado } from "../types";
import { InteressadosPage } from "./interessados-page";

const apiMocks = vi.hoisted(() => ({
  createPessoa: vi.fn(),
  downloadPessoasExcel: vi.fn(),
  formatAppError: vi.fn((_error: unknown, fallback: string) => fallback),
  listPessoas: vi.fn(),
  updatePessoa: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

function buildPessoa(id: string, nome: string): Interessado {
  return {
    id,
    nome,
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
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("InteressadosPage", () => {
  it("abre a lista filtrada de processos ao clicar no nome da pessoa", async () => {
    apiMocks.listPessoas.mockResolvedValue({
      items: [buildPessoa("11111111-1111-1111-1111-111111111111", "Maria Assinante")],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    render(
      <AuthContext.Provider
        value={{
          user: {
            id: 1,
            email: "admin@jmu.local",
            name: "Admin",
            role: "admin",
            permissions: ["cadastro.interessado.read", "cadastro.interessado.write"],
          },
          status: "authenticated",
          login: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
          hasPermission: vi.fn().mockReturnValue(true),
        }}
      >
        <MemoryRouter>
          <InteressadosPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const link = await screen.findByRole("link", { name: "Maria Assinante" });
    expect(link).toHaveAttribute(
      "href",
      "/pre-demandas?pessoaId=11111111-1111-1111-1111-111111111111&pessoaNome=Maria+Assinante&view=table&page=1",
    );
  });
});
