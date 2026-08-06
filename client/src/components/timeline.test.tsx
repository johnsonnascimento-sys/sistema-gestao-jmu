import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline } from "./timeline";
import type { TimelineEvent } from "../types";

describe("Timeline", () => {
  it("preserves line breaks in andamento text", () => {
    const event: TimelineEvent = {
      id: "timeline-1",
      preId: "PRE-2026-001",
      principalNumero: "PRE-2026-001",
      type: "andamento",
      occurredAt: "2026-06-09T20:00:00.000Z",
      actor: null,
      motivo: "Linha 1\nLinha 2",
      observacoes: "Paragrafo A\n\nParagrafo B",
      descricao: "Descricao com\nquebra de linha",
      statusAnterior: null,
      statusNovo: null,
      seiNumeroAnterior: null,
      seiNumeroNovo: null,
    };

    render(<Timeline events={[event]} />);

    expect(screen.getByText((_, element) => element?.textContent === "Descricao com\nquebra de linha")).toHaveClass(
      "whitespace-pre-wrap",
    );
    expect(screen.getByText((_, element) => element?.textContent === "Linha 1\nLinha 2")).toHaveClass(
      "whitespace-pre-wrap",
    );
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && element.textContent === "Paragrafo A\n\nParagrafo B",
      ),
    ).toHaveClass("whitespace-pre-wrap");
  });
});
