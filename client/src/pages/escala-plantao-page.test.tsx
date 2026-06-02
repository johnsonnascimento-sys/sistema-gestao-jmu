import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EscalaPlantaoPage } from "./escala-plantao-page";

const { listEscalaPlantaoDadosMock } = vi.hoisted(() => ({
  listEscalaPlantaoDadosMock: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>(
    "../lib/api",
  );

  return {
    ...actual,
    formatAppError: vi.fn((_error: unknown, fallback: string) => fallback),
    listEscalaPlantaoDados: listEscalaPlantaoDadosMock,
  };
});

describe("EscalaPlantaoPage", () => {
  beforeEach(() => {
    listEscalaPlantaoDadosMock.mockResolvedValue({
      pessoas: [
        {
          id: "p-1",
          nome: "Maria da Escala",
          cargo: "Analista",
          matricula: "MAT-007",
        },
      ],
      setores: [
        {
          id: "s-1",
          sigla: "DIPES",
          nomeCompleto: "Diretoria de Gestão de Pessoas",
        },
      ],
    });
  });

  it("renders public escala data", async () => {
    render(<EscalaPlantaoPage />);

    expect(await screen.findByText("Maria da Escala")).toBeInTheDocument();
    expect(await screen.findByText("DIPES")).toBeInTheDocument();
  });
});
