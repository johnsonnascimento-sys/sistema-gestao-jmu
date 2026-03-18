import { describe, expect, it } from "vitest";
import { formatDateOnlyPtBr } from "./date";

describe("formatDateOnlyPtBr", () => {
  it("formats a date-only value without timezone drift", () => {
    expect(formatDateOnlyPtBr("2026-03-18")).toBe("18/03/2026");
  });

  it("returns fallback for empty values", () => {
    expect(formatDateOnlyPtBr(null)).toBe("-");
    expect(formatDateOnlyPtBr(undefined, "Sem data")).toBe("Sem data");
  });
});
