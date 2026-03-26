import { describe, expect, it } from "vitest";
import { createPool } from "./db";

describe("createPool", () => {
  it("disables ssl for localhost urls", () => {
    const pool = createPool("postgresql://user:pass@localhost:5432/test");
    expect(pool.options.ssl).toBe(false);
    void pool.end();
  });

  it("disables ssl when sslmode=disable is explicit", () => {
    const pool = createPool("postgresql://user:pass@gestor-jmu-db:5432/test?sslmode=disable");
    expect(pool.options.ssl).toBe(false);
    void pool.end();
  });

  it("keeps ssl enabled for remote managed databases", () => {
    const pool = createPool("postgresql://user:pass@aws-0-us-west-2.pooler.supabase.com:5432/postgres");
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: false });
    void pool.end();
  });
});
