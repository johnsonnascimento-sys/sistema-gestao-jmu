import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth-context";
import { ApiError } from "../lib/api";
import type { AppPermission } from "../types";
import { NewPreDemandaPage } from "./new-pre-demanda-page";

const apiMocks = vi.hoisted(() => ({
  addPreDemandaInteressado: vi.fn(),
  createPreDemanda: vi.fn(),
  getPreDemanda: vi.fn(),
  listAssuntos: vi.fn(),
  listPessoas: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, ...apiMocks };
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{JSON.stringify(location)}</div>;
}

function renderPage(
  search = "",
  permissions: AppPermission[] = [
    "pre_demanda.create",
    "pre_demanda.manage_vinculos",
  ],
) {
  render(
    <AuthContext.Provider
      value={{
        user: null,
        status: "authenticated",
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        hasPermission: (permission) => permissions.includes(permission),
      }}
    >
      <MemoryRouter initialEntries={[`/pre-demandas/nova${search}`]}>
        <LocationProbe />
        <Routes>
          <Route element={<NewPreDemandaPage />} path="/pre-demandas/nova" />
          <Route element={<div>Detalhe do processo</div>} path="/pre-demandas/:preId" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Assunto"), {
    target: { value: "Assunto relacionado" },
  });
  fireEvent.change(screen.getByLabelText("Prazo do processo *"), {
    target: { value: "2026-10-01" },
  });
}

describe("NewPreDemandaPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiMocks.getPreDemanda.mockResolvedValue({
      preId: "PRE-2026-001",
      principalNumero: "000181/26-02.227",
      assunto: "Processo de origem",
    });
    apiMocks.listAssuntos.mockResolvedValue([]);
    apiMocks.listPessoas.mockResolvedValue({ items: [], total: 0 });
    apiMocks.createPreDemanda.mockResolvedValue({
      preId: "PRE-2026-002",
      existingPreId: null,
      idempotent: false,
    });
  });

  afterEach(cleanup);

  it("valida a origem e preserva o cadastro relacionado em branco", async () => {
    renderPage("?origemPreId=PRE-2026-001");

    expect(await screen.findByText("Processo de origem")).toBeInTheDocument();
    expect(
      screen.getByText("PRE-2026-001 · 000181/26-02.227 · Processo de origem"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Assunto")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/pre-demandas/PRE-2026-001");
  });

  it("envia a origem na criação atômica e abre o novo detalhe", async () => {
    renderPage("?origemPreId=PRE-2026-001");
    await screen.findByText("Processo de origem");
    await fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Salvar processo" }));

    await waitFor(() =>
      expect(apiMocks.createPreDemanda).toHaveBeenCalledWith(
        expect.objectContaining({ origem_pre_id: "PRE-2026-001" }),
      ),
    );
    expect(await screen.findByText("Detalhe do processo")).toBeInTheDocument();
  });

  it("abre o detalhe existente no replay idempotente relacionado", async () => {
    apiMocks.createPreDemanda.mockResolvedValue({
      preId: "PRE-2026-002",
      existingPreId: "PRE-2026-099",
      idempotent: true,
    });
    renderPage("?origemPreId=PRE-2026-001");
    await screen.findByText("Processo de origem");
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Salvar processo" }));

    expect(await screen.findByText("Detalhe do processo")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("PRE-2026-099");
  });

  it("preserva o resultado do cadastro comum sem consultar origem", async () => {
    renderPage();
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Salvar processo" }));

    expect(await screen.findByText("Processo criado com sucesso.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PRE-2026-002" })).toHaveAttribute(
      "href",
      "/pre-demandas/PRE-2026-002",
    );
    expect(apiMocks.getPreDemanda).not.toHaveBeenCalled();
    expect(apiMocks.createPreDemanda).toHaveBeenCalledWith(
      expect.objectContaining({ origem_pre_id: undefined }),
    );
  });

  it("leva ao detalhe com aviso se a inclusão de interessados falhar após criar", async () => {
    apiMocks.listPessoas.mockResolvedValue({
      items: [{ id: "pessoa-1", nome: "Maria Interessada" }],
      total: 1,
    });
    apiMocks.addPreDemandaInteressado.mockRejectedValue(new Error("falha"));
    renderPage("?origemPreId=PRE-2026-001");
    await screen.findByText("Processo de origem");
    fireEvent.change(screen.getByPlaceholderText("Buscar pessoas para vincular como interessadas"), {
      target: { value: "Maria" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Maria Interessada/i }));
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Salvar processo" }));

    expect(await screen.findByText("Detalhe do processo")).toBeInTheDocument();
    expect(apiMocks.addPreDemandaInteressado).toHaveBeenCalledWith(
      "PRE-2026-002",
      { interessado_id: "pessoa-1", papel: "interessado" },
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "Não envie o cadastro novamente",
    );
  });

  it("bloqueia uma origem inválida", async () => {
    apiMocks.getPreDemanda.mockRejectedValue(new Error("não encontrado"));
    renderPage("?origemPreId=PRE-inválida");

    expect(
      await screen.findByText("Não foi possível localizar o processo de origem para iniciar o relacionado."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar processo" })).toBeDisabled();
  });

  it("mantém o link do processo existente quando a API informa conflito", async () => {
    apiMocks.createPreDemanda.mockRejectedValue(
      new ApiError(409, "DUPLICATE", "duplicado", {
        existingPreId: "PRE-2026-090",
      }),
    );
    renderPage("?origemPreId=PRE-2026-001");
    await screen.findByText("Processo de origem");
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Salvar processo" }));

    expect(
      await screen.findByText("Já existe um processo com estes dados, mas ele não está vinculado à origem selecionada."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir processo existente" })).toHaveAttribute(
      "href",
      "/pre-demandas/PRE-2026-090",
    );
  });

  it("exige as permissões de criar e gerir vínculos para uma origem informada na URL", async () => {
    renderPage("?origemPreId=PRE-2026-001", ["pre_demanda.create"]);

    expect(
      await screen.findByText("Você não tem permissão para iniciar um processo relacionado."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar processo" })).toBeDisabled();
  });
});
