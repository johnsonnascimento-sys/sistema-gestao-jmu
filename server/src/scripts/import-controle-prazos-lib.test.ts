import { describe, expect, it } from "vitest";
import { parseControlePrazosRow, parseHistorico, parseSeiNumbers } from "./import-controle-prazos-lib";

describe("import-controle-prazos-lib", () => {
  it("extracts multiple SEI numbers from a single cell", () => {
    expect(parseSeiNumbers("000065/26-02.227\n030198/25-00.019")).toEqual(["000065/26-02.227", "030198/25-00.019"]);
  });

  it("breaks historico into dated andamentos", () => {
    const andamentos = parseHistorico(
      "02/03/2026, 15h15, mandei o bilhete.\n\n26/01/2026, 17h32, fiz um oficio.\n26/01/2026, 16h12, Elaine ligou.",
    );

    expect(andamentos).toHaveLength(3);
    expect(andamentos[0]?.dataHora).toBe("2026-03-02T15:15:00.000Z");
    expect(andamentos[2]?.descricao).toContain("Elaine ligou");
  });

  it("maps a spreadsheet row with completed prazo and warnings", () => {
    const parsed = parseControlePrazosRow(
      {
        "PRAZO 1": "FEITA",
        "PRAZO 2": null,
        "PRAZO 3": new Date("2026-04-06T00:00:00.000Z"),
        ASSUNTO: "Planejamento orcamentario",
        "NUMEROS E ASSOCIADOS": "004826/26-00.088",
        "DATA DE INICIO": new Date("2026-03-11T00:00:00.000Z"),
        "INTERESSADO 1": "DRA. VERA",
        HISTORICO: "02/03/2026, 15h15, registrar teste.",
        TAREFAS: "verificar com o Eduardo",
      },
      2,
    );

    expect(parsed.status).toBe("encerrada");
    expect(parsed.prazoInicial.completed).toBe(true);
    expect(parsed.prazoFinal.value).toBe("2026-04-06");
    expect(parsed.interessados[0]).toBe("DRA. VERA");
    expect(parsed.errors).toEqual([]);
  });

  it("falls back when assunto, interessado and data de inicio are missing", () => {
    const parsed = parseControlePrazosRow(
      {
        ASSUNTO: "",
        "DATA DE INICIO": null,
        "INTERESSADO 1": "",
        HISTORICO: "",
        TAREFAS: "",
        "PRAZO 3": "01 a 31 de outubro de 2026",
      },
      99,
    );

    expect(parsed.assunto).toContain("linha 99");
    expect(parsed.interessados[0]).toBe("Sem interessado informado");
    expect(parsed.dataReferencia).toBe("2026-10-01");
    expect(parsed.warnings.some((item) => item.includes("ASSUNTO vazio"))).toBe(true);
    expect(parsed.warnings.some((item) => item.includes("Nenhum interessado identificado"))).toBe(true);
    expect(parsed.errors).toEqual([]);
  });
});
