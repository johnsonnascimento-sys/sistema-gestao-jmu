import { describe, expect, it } from "vitest";
import { isValidSei } from "./sei";

describe("isValidSei", () => {
  it("accepts the current short format, the legacy short format and judicial numbers", () => {
    expect(isValidSei("000181/26-02.227")).toBe(true);
    expect(isValidSei("022372/25-00.01")).toBe(true);
    expect(isValidSei("0000001-10.2026.4.00.0001")).toBe(true);
  });

  it("rejects malformed values", () => {
    expect(isValidSei("000181/26-02.2")).toBe(false);
    expect(isValidSei("abc")).toBe(false);
  });
});
