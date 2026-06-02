import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../auth-context";
import { AppShell } from "./app-shell";

vi.mock("../hooks/use-events", () => ({
  useEvents: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  getRuntimeHealth: vi.fn().mockResolvedValue({
    ok: true,
    version: "1.0.0",
    commitSha: "abcdef1234567890",
    commitAt: "2026-06-02T00:00:00.000Z",
    uptimeSeconds: 42,
  }),
}));

vi.mock("../lib/external-links", () => ({
  getEscalaPlantaoUrl: vi.fn(),
}));

import { getEscalaPlantaoUrl } from "../lib/external-links";

const mockedGetEscalaPlantaoUrl = vi.mocked(getEscalaPlantaoUrl);

describe("AppShell", () => {
  beforeEach(() => {
    mockedGetEscalaPlantaoUrl.mockReturnValue("https://escala.example.com");
  });

  it("exibe o atalho externo para a escala de plantao", async () => {
    render(
      <AuthContext.Provider
        value={{
          user: {
            id: 1,
            email: "user@test.local",
            name: "User",
            role: "operador",
            permissions: ["dashboard.read"],
          },
          status: "authenticated",
          login: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
          hasPermission: vi.fn().mockReturnValue(false),
        }}
      >
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route element={<div>Dashboard</div>} path="/dashboard" />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const link = await screen.findByRole("link", { name: /escala de plant/i });
    expect(link).toHaveAttribute("href", "https://escala.example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
