import { describe, expect, it } from "vitest";
import { formatSeiInput, isValidSei, normalizeSeiValue } from "./sei";

describe("SEI helpers", () => {
  it("accepts both the current and legacy SEI formats", () => {
    expect(isValidSei("000181/26-02.227")).toBe(true);
    expect(isValidSei("022372/25-00.01")).toBe(true);
    expect(isValidSei("0000001-10.2026.4.00.0001")).toBe(true);
  });

  it("normalizes digit-only input into the legacy or current masked format", () => {
    expect(formatSeiInput("022372250001")).toBe("022372/25-00.01");
    expect(normalizeSeiValue("0001812602227")).toBe("000181/26-02.227");
  });
});
