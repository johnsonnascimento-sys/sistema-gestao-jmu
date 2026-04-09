import { describe, expect, it } from "vitest";
import { ApiError, formatAppError } from "./api";

describe("formatAppError", () => {
  it("formats friendly business messages for active tramitacao", () => {
    const error = new ApiError(
      409,
      "TRAMITACAO_ALREADY_ACTIVE",
      "Os setores informados ja estao com tramitacao ativa para este processo.",
      null,
      "req-123",
    );

    expect(formatAppError(error, "Falha ao tramitar processo.")).toBe(
      "O processo ja esta em tramitacao para o setor selecionado. Referencia: req-123.",
    );
  });

  it("formats validation errors using field details when available", () => {
    const error = new ApiError(
      400,
      "VALIDATION_ERROR",
      "Payload invalido.",
      {
        fieldErrors: {
          setores_destino_ids: ["Informe ao menos um setor destino."],
        },
      },
      "req-456",
    );

    expect(formatAppError(error, "Falha ao salvar.")).toBe(
      "Informe ao menos um setor destino. Referencia: req-456.",
    );
  });

  it("uses a generic friendly message for server failures", () => {
    const error = new ApiError(500, "INTERNAL_ERROR", "boom");

    expect(formatAppError(error, "Falha ao salvar.")).toBe(
      "O servidor nao conseguiu concluir a operacao. Tente novamente em instantes.",
    );
  });
});
